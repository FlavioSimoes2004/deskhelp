import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { AgendaItem } from "./types.js";

const toItem = (r: RowDataPacket): AgendaItem => ({
  id: r.id,
  title: r.title,
  description: r.description,
  scheduledAt: r.scheduled_at,
  notifiedAt: r.notified_at,
  dismissedAt: r.dismissed_at,
  createdAt: r.created_at,
});

const COLUMNS = "id, title, description, scheduled_at, notified_at, dismissed_at, created_at";

export async function insertAgendaItem(
  userId: number,
  data: { title: string; description: string | null; scheduledAt: Date },
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO agenda_items (user_id, title, description, scheduled_at) VALUES (?, ?, ?, ?)",
    [userId, data.title, data.description, data.scheduledAt],
  );
  return result.insertId;
}

export async function findAgendaItem(userId: number, id: number): Promise<AgendaItem | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM agenda_items WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

/** upcoming = ainda não chegou a hora; past = já chegou. Próximos em ordem cronológica, passados do mais recente. */
export async function listAgendaItems(userId: number, when?: "upcoming" | "past"): Promise<AgendaItem[]> {
  const params: SqlParams = { userId };
  let where = "user_id = :userId";
  let order = "scheduled_at DESC, id DESC";
  if (when === "upcoming") {
    where += " AND scheduled_at > NOW()";
    order = "scheduled_at, id";
  } else if (when === "past") {
    where += " AND scheduled_at <= NOW()";
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM agenda_items WHERE ${where} ORDER BY ${order} LIMIT 500`,
    params,
  );
  return rows.map(toItem);
}

/** Itens cuja hora chegou e que o usuário ainda não dispensou (os avisos na tela). */
export async function listDueAgendaItems(userId: number): Promise<AgendaItem[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM agenda_items
     WHERE user_id = ? AND scheduled_at <= NOW() AND dismissed_at IS NULL
     ORDER BY scheduled_at, id`,
    [userId],
  );
  return rows.map(toItem);
}

/** Dispensa o aviso e marca a notificação dele como lida; false se o item não for do usuário. */
export async function dismissAgendaItem(userId: number, id: number): Promise<boolean> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>(
      "UPDATE agenda_items SET dismissed_at = COALESCE(dismissed_at, NOW()) WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    await conn.execute(
      "UPDATE notifications SET read_at = NOW() WHERE agenda_id = ? AND user_id = ? AND read_at IS NULL",
      [id, userId],
    );
    await conn.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Cria a notificação de cada item cuja hora chegou e marca o item como avisado,
 * na mesma transação (FOR UPDATE evita duplicar se duas execuções coincidirem).
 * Sem userId, trata todos os usuários. Devolve quantos avisos foram gerados.
 */
export async function deliverDueAgendaItems(userId?: number): Promise<number> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [due] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id FROM agenda_items
       WHERE notified_at IS NULL AND scheduled_at <= NOW() ${userId === undefined ? "" : "AND user_id = ?"}
       ORDER BY scheduled_at LIMIT 200 FOR UPDATE`,
      userId === undefined ? [] : [userId],
    );
    for (const item of due) {
      await conn.execute("INSERT INTO notifications (user_id, type, agenda_id) VALUES (?, 'agenda', ?)", [
        item.user_id,
        item.id,
      ]);
    }
    if (due.length > 0) {
      await conn.query("UPDATE agenda_items SET notified_at = NOW() WHERE id IN (?)", [due.map((d) => d.id)]);
    }
    await conn.commit();
    return due.length;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
