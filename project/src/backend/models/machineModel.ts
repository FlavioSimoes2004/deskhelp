import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool, type SqlParams } from "../config/database.js";
import type { Machine } from "./types.js";

const SELECT_MACHINE = `
  SELECT m.*, u.name AS user_name
  FROM machines m
  LEFT JOIN users u ON u.id = m.user_id`;

interface MachineRow extends RowDataPacket {
  id: number;
  mac_address: string;
  ip_address: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: Date;
  updated_at: Date;
}

const toMachine = (row: MachineRow): Machine => ({
  id: row.id,
  macAddress: row.mac_address,
  ipAddress: row.ip_address,
  userId: row.user_id,
  userName: row.user_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface MachineFields {
  macAddress: string;
  ipAddress: string | null;
  userId: number | null;
}

export async function listMachines(filters: { search?: string }): Promise<Machine[]> {
  const params: SqlParams = {};
  let where = "";
  if (filters.search) {
    where = "WHERE (m.mac_address LIKE :search OR m.ip_address LIKE :search OR u.name LIKE :search)";
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

export async function insertMachine(data: MachineFields): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO machines (mac_address, ip_address, user_id) VALUES (:macAddress, :ipAddress, :userId)",
    { ...data },
  );
  return result.insertId;
}

export async function updateMachine(id: number, data: Partial<MachineFields>): Promise<void> {
  const columns: Record<keyof MachineFields, string> = {
    macAddress: "mac_address",
    ipAddress: "ip_address",
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
  await pool.query(`UPDATE machines SET ${sets.join(", ")} WHERE id = :id`, params);
}
