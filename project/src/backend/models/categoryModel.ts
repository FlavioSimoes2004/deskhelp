import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/database.js";

export interface Category {
  id: number;
  name: string;
}

export async function listCategories(): Promise<Category[]> {
  const [rows] = await pool.query<(RowDataPacket & Category)[]>("SELECT id, name FROM categories ORDER BY name");
  return rows.map(({ id, name }) => ({ id, name }));
}

export async function categoryExists(id: number): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM categories WHERE id = ?", [id]);
  return rows.length > 0;
}

/** Busca por nome sem diferenciar maiúsculas nem acentos (a collation da coluna faz isso). */
export async function findCategoryByName(name: string): Promise<Category | null> {
  const [rows] = await pool.execute<(RowDataPacket & Category)[]>("SELECT id, name FROM categories WHERE name = ?", [
    name,
  ]);
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
}

export async function insertCategory(name: string): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>("INSERT INTO categories (name) VALUES (?)", [name]);
  return result.insertId;
}
