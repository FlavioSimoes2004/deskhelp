import type { RowDataPacket } from "mysql2";
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
