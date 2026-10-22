import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../config/database.js";

/** Todas as configurações gravadas (chave -> valor). */
export async function readSettingRows(): Promise<Record<string, string>> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT setting_key, value FROM app_settings");
  return Object.fromEntries(rows.map((r) => [r.setting_key, r.value]));
}

/** Grava (cria ou substitui) as configurações informadas. */
export async function writeSettings(values: Record<string, string>, userId: number): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    await pool.execute(
      `INSERT INTO app_settings (setting_key, value, updated_by) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
      [key, value, userId],
    );
  }
}
