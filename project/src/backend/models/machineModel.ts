import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { MachineChange } from "../services/machineRules.js";
import type { Machine, MachineHistoryEntry } from "./types.js";

const SELECT_MACHINE = `
  SELECT m.*, u.name AS user_name
  FROM machines m
  LEFT JOIN users u ON u.id = m.user_id`;

interface MachineRow extends RowDataPacket {
  id: number;
  mac_address: string;
  ip_address: string | null;
  description: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: Date;
  updated_at: Date;
}

const toMachine = (row: MachineRow): Machine => ({
  id: row.id,
  macAddress: row.mac_address,
  ipAddress: row.ip_address,
  description: row.description,
  userId: row.user_id,
  userName: row.user_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface MachineFields {
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  userId: number | null;
}

export async function listMachines(filters: { search?: string }): Promise<Machine[]> {
  const params: SqlParams = {};
  let where = "";
  if (filters.search) {
    where =
      "WHERE (m.mac_address LIKE :search OR m.ip_address LIKE :search OR m.description LIKE :search OR u.name LIKE :search)";
    params.search = `%${filters.search}%`;
  }
  const [rows] = await pool.query<MachineRow[]>(`${SELECT_MACHINE} ${where} ORDER BY m.mac_address`, params);
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
        `INSERT INTO machines (mac_address, ip_address, description, user_id)
         VALUES (:macAddress, :ipAddress, :description, :userId)`,
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
  const columns: Record<keyof MachineFields, string> = {
    macAddress: "mac_address",
    ipAddress: "ip_address",
    description: "description",
    userId: "user_id",
  };
  const sets: string[] = [];
  const params: SqlParams = { id };
  for (const key of Object.keys(columns) as (keyof MachineFields)[]) {
    if (data[key] === undefined) continue;
    sets.push(`${columns[key]} = :${key}`);
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
