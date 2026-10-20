import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { AgendaItem } from "./types.js";

const toItem = (r: RowDataPacket): AgendaItem => ({
  id: r.id,
  ticketId: r.ticket_id,
  ticketTitle: r.ticket_title,
  title: r.title,
  description: r.description,
  scheduledAt: r.scheduled_at,
  notifiedAt: r.notified_at,
  dismissedAt: r.dismissed_at,
  createdAt: r.created_at,
});

const SELECT_ITEM = `
  SELECT ag.id, ag.ticket_id, t.title AS ticket_title, ag.title, ag.description, ag.scheduled_at,
         ag.notified_at, ag.dismissed_at, ag.created_at
  FROM agenda_items ag
  LEFT JOIN tickets t ON t.id = ag.ticket_id`;

export async function insertAgendaItem(
  userId: number,
  data: { title: string; description: string | null; scheduledAt: Date; ticketId: number | null },
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO agenda_items (user_id, ticket_id, title, description, scheduled_at) VALUES (?, ?, ?, ?, ?)",
    [userId, data.ticketId, data.title, data.description, data.scheduledAt],
  );
  return result.insertId;
}

export async function findAgendaItem(userId: number, id: number): Promise<AgendaItem | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_ITEM} WHERE ag.id = ? AND ag.user_id = ?`,
    [id, userId],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

/**
 * upcoming = ainda não chegou a hora; past = já chegou. Próximos em ordem cronológica,
 * passados do mais recente. ticketId restringe aos itens vinculados a esse chamado.
 */
export async function listAgendaItems(
  userId: number,
  filters: { when?: "upcoming" | "past"; ticketId?: number } = {},
): Promise<AgendaItem[]> {
  const params: SqlParams = { userId };
  let where = "ag.user_id = :userId";
  let order = "ag.scheduled_at DESC, ag.id DESC";
  if (filters.when === "upcoming") {
    where += " AND ag.scheduled_at > NOW()";
    order = "ag.scheduled_at, ag.id";
  } else if (filters.when === "past") {
    where += " AND ag.scheduled_at <= NOW()";
  }
  if (filters.ticketId !== undefined) {
    where += " AND ag.ticket_id = :ticketId";
    params.ticketId = filters.ticketId;
  }
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT_ITEM} WHERE ${where} ORDER BY ${order} LIMIT 500`, params);
  return rows.map(toItem);
}

/** Itens cuja hora chegou e que o usuário ainda não dispensou (os avisos na tela). */
export async function listDueAgendaItems(userId: number): Promise<AgendaItem[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_ITEM}
     WHERE ag.user_id = ? AND ag.scheduled_at <= NOW() AND ag.dismissed_at IS NULL
     ORDER BY ag.scheduled_at, ag.id`,
    [userId],
  );
  return rows.map(toItem);
}

/** Exclui o item (a notificação dele sai junto); false se o item não for do usuário. */
export async function deleteAgendaItem(userId: number, id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM agenda_items WHERE id = ? AND user_id = ?", [
    id,
    userId,
  ]);
  return result.affectedRows > 0;
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
