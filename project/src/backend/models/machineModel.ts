import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { MachineChange, MachineEditableFields } from "../services/machineRules.js";
import type { Machine, MachineHistoryEntry, StorageType } from "./types.js";

const SELECT_MACHINE = `
  SELECT m.*, u.name AS user_name
  FROM machines m
  LEFT JOIN users u ON u.id = m.user_id`;

interface MachineRow extends RowDataPacket {
  id: number;
  name: string | null;
  mac_address: string;
  ip_address: string | null;
  description: string | null;
  ram_gb: number | null;
  ram_type: string | null;
  cpu: string | null;
  storage_gb: number | null;
  storage_type: StorageType | null;
  gpu: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: Date;
  updated_at: Date;
}

const toMachine = (row: MachineRow): Machine => ({
  id: row.id,
  name: row.name,
  macAddress: row.mac_address,
  ipAddress: row.ip_address,
  description: row.description,
  ramGb: row.ram_gb,
  ramType: row.ram_type,
  cpu: row.cpu,
  storageGb: row.storage_gb,
  storageType: row.storage_type,
  gpu: row.gpu,
  userId: row.user_id,
  userName: row.user_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export type MachineFields = MachineEditableFields;

/** Campo da aplicação -> coluna da tabela machines. */
const COLUMNS: Record<keyof MachineFields, string> = {
  name: "name",
  macAddress: "mac_address",
  ipAddress: "ip_address",
  description: "description",
  ramGb: "ram_gb",
  ramType: "ram_type",
  cpu: "cpu",
  storageGb: "storage_gb",
  storageType: "storage_type",
  gpu: "gpu",
  userId: "user_id",
};
const FIELDS = Object.keys(COLUMNS) as (keyof MachineFields)[];

export interface MachineFilters {
  /** Busca geral em vários campos. */
  search?: string;
  name?: string;
  cpu?: string;
  gpu?: string;
  ramType?: string;
  ramGbMin?: number;
  storageGbMin?: number;
  storageType?: StorageType;
}

// Filtros de texto por coluna (contém) e de quantidade (mínimo); nomes de coluna fixos.
const TEXT_FILTERS = { name: "m.name", cpu: "m.cpu", gpu: "m.gpu", ramType: "m.ram_type" } as const;
const MIN_FILTERS = { ramGbMin: "m.ram_gb", storageGbMin: "m.storage_gb" } as const;

export async function listMachines(filters: MachineFilters): Promise<Machine[]> {
  const where: string[] = [];
  const params: SqlParams = {};
  if (filters.search) {
    where.push(`(m.name LIKE :search OR m.mac_address LIKE :search OR m.ip_address LIKE :search
              OR m.description LIKE :search OR m.cpu LIKE :search OR m.gpu LIKE :search
              OR m.ram_type LIKE :search OR u.name LIKE :search)`);
    params.search = `%${filters.search}%`;
  }
  for (const [key, column] of Object.entries(TEXT_FILTERS) as [keyof typeof TEXT_FILTERS, string][]) {
    if (!filters[key]) continue;
    where.push(`${column} LIKE :${key}`);
    params[key] = `%${filters[key]}%`;
  }
  for (const [key, column] of Object.entries(MIN_FILTERS) as [keyof typeof MIN_FILTERS, string][]) {
    if (filters[key] === undefined) continue;
    where.push(`${column} >= :${key}`);
    params[key] = filters[key];
  }
  if (filters.storageType) {
    where.push("m.storage_type = :storageType");
    params.storageType = filters.storageType;
  }
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query<MachineRow[]>(`${SELECT_MACHINE} ${sql} ORDER BY m.name IS NULL, m.name, m.mac_address`, params);
  return rows.map(toMachine);
}

export async function findMachineById(id: number): Promise<Machine | null> {
  const [rows] = await pool.query<MachineRow[]>(`${SELECT_MACHINE} WHERE m.id = :id`, { id });
  return rows[0] ? toMachine(rows[0]) : null;
}

export async function findMachineByMac(macAddress: string): Promise<Machine | null> {
  const [rows] = await pool.query<MachineRow[]>(`${SELECT_MACHINE} WHERE m.mac_address = :macAddress`, { macAddress });
  return rows[0] ? toMachine(rows[0]) : null;
}

/** Executa a escrita e grava o histórico na mesma transação. */
async function withHistory(
  userId: number,
  write: (conn: PoolConnection) => Promise<number>,
  changes: MachineChange[],
): Promise<number> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const machineId = await write(conn);
    for (const change of changes) {
      await conn.execute(
        `INSERT INTO machine_history (machine_id, user_id, field, old_value, new_value)
         VALUES (:machineId, :userId, :field, :oldValue, :newValue)`,
        {
          machineId,
          userId,
          field: change.field,
          oldValue: change.oldValue?.slice(0, 255) ?? null,
          newValue: change.newValue?.slice(0, 255) ?? null,
        },
      );
    }
    await conn.commit();
    return machineId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function insertMachine(data: MachineFields, userId: number, changes: MachineChange[]): Promise<number> {
  return withHistory(
    userId,
    async (conn) => {
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO machines (${FIELDS.map((f) => COLUMNS[f]).join(", ")})
         VALUES (${FIELDS.map((f) => `:${f}`).join(", ")})`,
        { ...data },
      );
      return result.insertId;
    },
    changes,
  );
}

export async function updateMachine(
  id: number,
  data: Partial<MachineFields>,
  userId: number,
  changes: MachineChange[],
): Promise<void> {
  const sets: string[] = [];
  const params: SqlParams = { id };
  for (const key of FIELDS) {
    if (data[key] === undefined) continue;
    sets.push(`${COLUMNS[key]} = :${key}`);
    params[key] = data[key];
  }
  if (sets.length === 0) return;
  await withHistory(
    userId,
    async (conn) => {
      await conn.query(`UPDATE machines SET ${sets.join(", ")} WHERE id = :id`, params);
      return id;
    },
    changes,
  );
}

export async function listMachineHistory(machineId: number): Promise<MachineHistoryEntry[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT h.id, h.machine_id, h.user_id, u.name AS user_name, h.field, h.old_value, h.new_value, h.created_at
     FROM machine_history h JOIN users u ON u.id = h.user_id
     WHERE h.machine_id = ? ORDER BY h.created_at DESC, h.id DESC`,
    [machineId],
  );
  return rows.map((r) => ({
    id: r.id,
    machineId: r.machine_id,
    userId: r.user_id,
    userName: r.user_name,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  }));
}
