import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool, type SqlParams } from "../config/database.js";
import type { PublicUser, Role } from "./types.js";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: number;
  session_id: string | null;
  created_at: Date;
}

const toPublic = (row: UserRow): PublicUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  active: row.active === 1,
  createdAt: row.created_at,
});

export async function findUserByEmail(email: string) {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE email = ?", [email]);
  const row = rows[0];
  return row ? { ...toPublic(row), passwordHash: row.password_hash, sessionId: row.session_id } : null;
}

export async function findUserById(id: number) {
  const [rows] = await pool.execute<UserRow[]>("SELECT * FROM users WHERE id = ?", [id]);
  const row = rows[0];
  return row ? { ...toPublic(row), passwordHash: row.password_hash, sessionId: row.session_id } : null;
}

export async function listUsers(filters: { search?: string; role?: Role; active?: boolean }): Promise<PublicUser[]> {
  const where: string[] = [];
  const params: SqlParams = {};
  if (filters.search) {
    where.push("(name LIKE :search OR email LIKE :search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.role) {
    where.push("role = :role");
    params.role = filters.role;
  }
  if (filters.active !== undefined) {
    where.push("active = :active");
    params.active = filters.active ? 1 : 0;
  }
  const sql = `SELECT * FROM users ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY name`;
  const [rows] = await pool.query<UserRow[]>(sql, params);
  return rows.map(toPublic);
}

/** Administradores e suporte (ativos e desativados), quem pode ser responsável por chamados. */
export async function listStaff(): Promise<PublicUser[]> {
  const [rows] = await pool.query<UserRow[]>("SELECT * FROM users WHERE role IN ('admin', 'support') ORDER BY name");
  return rows.map(toPublic);
}

export async function insertUser(data: { name: string; email: string; passwordHash: string; role: Role }) {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :passwordHash, :role)",
    data,
  );
  return result.insertId;
}

export async function updateUser(
  id: number,
  data: { name?: string; email?: string; role?: Role; active?: boolean; passwordHash?: string },
) {
  const columns: Record<string, string> = {
    name: "name",
    email: "email",
    role: "role",
    active: "active",
    passwordHash: "password_hash",
  };
  const sets: string[] = [];
  const params: SqlParams = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    sets.push(`${columns[key]} = :${key}`);
    params[key] = typeof value === "boolean" ? Number(value) : value;
  }
  if (sets.length === 0) return;
  await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = :id`, params);
}

export async function countUsers(): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0]?.total ?? 0);
}

/** Define a sessão atual da conta (novo login); a anterior deixa de valer. */
export async function setSessionId(id: number, sessionId: string): Promise<void> {
  await pool.execute("UPDATE users SET session_id = ? WHERE id = ?", [sessionId, id]);
}

/** Encerra a sessão, se ainda for a atual (um logout antigo não derruba um login mais novo). */
export async function clearSessionId(id: number, sessionId: string): Promise<void> {
  await pool.execute("UPDATE users SET session_id = NULL WHERE id = ? AND session_id = ?", [id, sessionId]);
}
