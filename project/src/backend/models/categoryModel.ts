import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/database.js";

export interface Category {
  id: number;
  name: string;
  /** Aparece para escolher ao abrir/alterar um chamado. */
  active: boolean;
}

const toCategory = (r: RowDataPacket): Category => ({ id: r.id, name: r.name, active: r.active === 1 });

/** Todas as categorias (ativas e inativas), em ordem alfabética. */
export async function listCategories(): Promise<Category[]> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, name, active FROM categories ORDER BY name");
  return rows.map(toCategory);
}

export async function findCategoryById(id: number): Promise<Category | null> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT id, name, active FROM categories WHERE id = ?", [id]);
  return rows[0] ? toCategory(rows[0]) : null;
}

/** Busca por nome sem diferenciar maiúsculas nem acentos (a collation da coluna faz isso). */
export async function findCategoryByName(name: string): Promise<Category | null> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT id, name, active FROM categories WHERE name = ?", [name]);
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function insertCategory(name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>("INSERT INTO categories (name) VALUES (?)", [name]);
  return result.insertId;
}

export async function setCategoryActive(id: number, active: boolean): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>("UPDATE categories SET active = ? WHERE id = ?", [
    active ? 1 : 0,
    id,
  ]);
  return result.affectedRows > 0;
}
