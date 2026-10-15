import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { Notification, NotificationType } from "./types.js";

export interface NewNotification {
  userId: number;
  type: NotificationType;
  ticketId: number;
  actorId: number;
  commentId?: number | null;
}

/** Grava as notificações na conexão (transação) de quem as gerou. */
export async function insertNotifications(conn: PoolConnection, items: NewNotification[]): Promise<void> {
  for (const n of items) {
    await conn.execute(
      "INSERT INTO notifications (user_id, type, ticket_id, actor_id, comment_id) VALUES (?, ?, ?, ?, ?)",
      [n.userId, n.type, n.ticketId, n.actorId, n.commentId ?? null],
    );
  }
}

export interface NotificationFilters {
  read?: boolean;
  type?: NotificationType;
}

function buildWhere(userId: number, filters: NotificationFilters) {
  const where = ["n.user_id = :userId"];
  const params: SqlParams = { userId };
  if (filters.read !== undefined) where.push(filters.read ? "n.read_at IS NOT NULL" : "n.read_at IS NULL");
  if (filters.type) {
    where.push("n.type = :type");
    params.type = filters.type;
  }
  return { sql: `WHERE ${where.join(" AND ")}`, params };
}

export async function listNotifications(userId: number, filters: NotificationFilters, page: number, pageSize: number) {
  const { sql, params } = buildWhere(userId, filters);
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n.id, n.type, n.ticket_id, t.title AS ticket_title, n.actor_id, a.name AS actor_name,
            n.comment_id, LEFT(cm.body, 160) AS comment_excerpt, n.read_at, n.created_at
     FROM notifications n
     JOIN tickets t ON t.id = n.ticket_id
     JOIN users a ON a.id = n.actor_id
     LEFT JOIN ticket_comments cm ON cm.id = n.comment_id
     ${sql}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const [count] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM notifications n ${sql}`, params);
  const items: Notification[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    ticketId: r.ticket_id,
    ticketTitle: r.ticket_title,
    actorId: r.actor_id,
    actorName: r.actor_name,
    commentId: r.comment_id,
    commentExcerpt: r.comment_excerpt,
    read: r.read_at !== null,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
  return { items, total: Number(count[0]?.total ?? 0) };
}

export async function countUnread(userId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL",
    [userId],
  );
  return Number(rows[0]?.total ?? 0);
}

/** Marca como lida ou não lida; devolve false se a notificação não for do usuário. */
export async function setRead(userId: number, id: number, read: boolean): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE notifications SET read_at = ${read ? "COALESCE(read_at, CURRENT_TIMESTAMP)" : "NULL"}
     WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  return result.affectedRows > 0;
}

export async function markAllRead(userId: number): Promise<void> {
  await pool.execute("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", [
    userId,
  ]);
}
