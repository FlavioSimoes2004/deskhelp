import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import type { TicketChange, TicketEditableFields } from "../services/ticketRules.js";
import { insertNotifications, type NewNotification } from "./notificationModel.js";
import type {
  StoredAttachment,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketHistoryEntry,
  TicketPriority,
  TicketStatus,
} from "./types.js";

const SELECT_TICKET = `
  SELECT t.*, c.name AS category_name, r.name AS requester_name, a.name AS assignee_name,
         m.name AS machine_name, m.mac_address AS machine_mac_address, m.description AS machine_description
  FROM tickets t
  JOIN categories c ON c.id = t.category_id
  JOIN users r ON r.id = t.requester_id
  LEFT JOIN users a ON a.id = t.assignee_id
  LEFT JOIN machines m ON m.id = t.machine_id`;

interface TicketRow extends RowDataPacket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id: number;
  category_name: string;
  requester_id: number;
  requester_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
  machine_id: number | null;
  machine_name: string | null;
  machine_mac_address: string | null;
  machine_description: string | null;
  solution: string | null;
  rating: number | null;
  rating_comment: string | null;
  rated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  closed_at: Date | null;
}

const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  categoryId: row.category_id,
  categoryName: row.category_name,
  requesterId: row.requester_id,
  requesterName: row.requester_name,
  assigneeId: row.assignee_id,
  assigneeName: row.assignee_name,
  machineId: row.machine_id,
  machineName: row.machine_name,
  machineMacAddress: row.machine_mac_address,
  machineDescription: row.machine_description,
  solution: row.solution,
  rating: row.rating,
  ratingComment: row.rating_comment,
  ratedAt: row.rated_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at,
  closedAt: row.closed_at,
});

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: number;
  assigneeId?: number;
  requesterId?: number;
  search?: string;
  /** Data de abertura a partir de (AAAA-MM-DD, inclusivo). */
  from?: string;
  /** Data de abertura até (AAAA-MM-DD, inclusivo: vale o dia todo). */
  to?: string;
}

function buildWhere(filters: TicketFilters) {
  const where: string[] = [];
  const params: SqlParams = {};
  const exact: [keyof TicketFilters, string][] = [
    ["status", "t.status"],
    ["priority", "t.priority"],
    ["categoryId", "t.category_id"],
    ["assigneeId", "t.assignee_id"],
    ["requesterId", "t.requester_id"],
  ];
  for (const [key, column] of exact) {
    if (filters[key] === undefined) continue;
    where.push(`${column} = :${key}`);
    params[key] = filters[key];
  }
  if (filters.search) {
    const asId = Number(filters.search.replace(/^#/, ""));
    where.push(`(t.title LIKE :search OR t.description LIKE :search${Number.isInteger(asId) && asId > 0 ? " OR t.id = :searchId" : ""})`);
    params.search = `%${filters.search}%`;
    params.searchId = asId;
  }
  if (filters.from) {
    where.push("t.created_at >= :from");
    params.from = filters.from;
  }
  if (filters.to) {
    where.push("t.created_at < DATE_ADD(:to, INTERVAL 1 DAY)");
    params.to = filters.to;
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listTickets(filters: TicketFilters, page: number, pageSize: number) {
  const { sql, params } = buildWhere(filters);
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query<TicketRow[]>(
    `${SELECT_TICKET} ${sql} ORDER BY t.created_at DESC, t.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );
  const [count] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM tickets t ${sql}`, params);
  return { items: rows.map(toTicket), total: Number(count[0]?.total ?? 0) };
}

export async function findTicketById(id: number): Promise<Ticket | null> {
  const [rows] = await pool.query<TicketRow[]>(`${SELECT_TICKET} WHERE t.id = :id`, { id });
  return rows[0] ? toTicket(rows[0]) : null;
}

export async function insertTicket(data: {
  title: string;
  description: string;
  priority: TicketPriority;
  categoryId: number;
  requesterId: number;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tickets (title, description, priority, category_id, requester_id)
     VALUES (:title, :description, :priority, :categoryId, :requesterId)`,
    data,
  );
  return result.insertId;
}

const COLUMN: Record<keyof TicketEditableFields, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  categoryId: "category_id",
  assigneeId: "assignee_id",
  machineId: "machine_id",
  solution: "solution",
};

/** Atualiza o chamado e grava o histórico (e as notificações geradas) na mesma transação. */
export async function updateTicket(
  id: number,
  userId: number,
  patch: Partial<TicketEditableFields> & { resolvedAt?: Date | null; closedAt?: Date | null },
  changes: TicketChange[],
  notifications: NewNotification[] = [],
): Promise<void> {
  const sets: string[] = [];
  const params: SqlParams = { id };
  for (const key of Object.keys(COLUMN) as (keyof TicketEditableFields)[]) {
    if (patch[key] === undefined) continue;
    sets.push(`${COLUMN[key]} = :${key}`);
    params[key] = patch[key];
  }
  if (patch.resolvedAt !== undefined) {
    sets.push("resolved_at = :resolvedAt");
    params.resolvedAt = patch.resolvedAt;
  }
  if (patch.closedAt !== undefined) {
    sets.push("closed_at = :closedAt");
    params.closedAt = patch.closedAt;
  }
  if (sets.length === 0) return;

  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE tickets SET ${sets.join(", ")} WHERE id = :id`, params);
    for (const change of changes) {
      await conn.execute(
        `INSERT INTO ticket_history (ticket_id, user_id, field, old_value, new_value)
         VALUES (:ticketId, :userId, :field, :oldValue, :newValue)`,
        {
          ticketId: id,
          userId,
          field: change.field,
          oldValue: change.oldValue?.slice(0, 255) ?? null,
          newValue: change.newValue?.slice(0, 255) ?? null,
        },
      );
    }
    await insertNotifications(conn, notifications);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

const toAttachment = (r: RowDataPacket): TicketAttachment => ({
  id: r.id,
  commentId: r.comment_id,
  ticketId: r.ticket_id,
  originalName: r.original_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

/** Comentários do chamado; notas internas só quando includeInternal (admin/suporte). */
export async function listComments(ticketId: number, includeInternal: boolean): Promise<TicketComment[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cm.id, cm.ticket_id, cm.user_id, u.name AS user_name, cm.body, cm.is_internal, cm.created_at
     FROM ticket_comments cm JOIN users u ON u.id = cm.user_id
     WHERE cm.ticket_id = ? ${includeInternal ? "" : "AND cm.is_internal = 0"}
     ORDER BY cm.created_at, cm.id`,
    [ticketId],
  );
  const [attachmentRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, comment_id, ticket_id, original_name, mime_type, size_bytes, created_at
     FROM ticket_comment_attachments WHERE ticket_id = ? ORDER BY id`,
    [ticketId],
  );
  const byComment = new Map<number, TicketAttachment[]>();
  for (const r of attachmentRows) {
    byComment.set(r.comment_id, [...(byComment.get(r.comment_id) ?? []), toAttachment(r)]);
  }
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticket_id,
    userId: r.user_id,
    userName: r.user_name,
    body: r.body,
    internal: r.is_internal === 1,
    createdAt: r.created_at,
    attachments: byComment.get(r.id) ?? [],
  }));
}

export interface NewAttachment {
  originalName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Grava o comentário, os anexos (já salvos em disco) e as notificações para
 * notifyUserIds na mesma transação.
 */
export async function insertComment(
  ticketId: number,
  userId: number,
  body: string,
  attachments: NewAttachment[] = [],
  notifyUserIds: number[] = [],
  internal = false,
): Promise<number> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>(
      "INSERT INTO ticket_comments (ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?)",
      [ticketId, userId, body, internal ? 1 : 0],
    );
    for (const file of attachments) {
      await conn.execute(
        `INSERT INTO ticket_comment_attachments (comment_id, ticket_id, original_name, file_path, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.insertId, ticketId, file.originalName, file.filePath, file.mimeType, file.sizeBytes],
      );
    }
    await insertNotifications(
      conn,
      notifyUserIds.map((id) => ({ userId: id, type: "comment", ticketId, actorId: userId, commentId: result.insertId })),
    );
    // Comentar também conta como atividade no chamado.
    await conn.execute("UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [ticketId]);
    await conn.commit();
    return result.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function findAttachmentById(id: number): Promise<StoredAttachment | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.comment_id, a.ticket_id, a.original_name, a.file_path, a.mime_type, a.size_bytes,
            a.created_at, cm.is_internal
     FROM ticket_comment_attachments a JOIN ticket_comments cm ON cm.id = a.comment_id
     WHERE a.id = ?`,
    [id],
  );
  const r = rows[0];
  return r ? { ...toAttachment(r), filePath: r.file_path, internal: r.is_internal === 1 } : null;
}

export async function listHistory(ticketId: number): Promise<TicketHistoryEntry[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT h.id, h.ticket_id, h.user_id, u.name AS user_name, h.field, h.old_value, h.new_value, h.created_at
     FROM ticket_history h JOIN users u ON u.id = h.user_id
     WHERE h.ticket_id = ? ORDER BY h.created_at, h.id`,
    [ticketId],
  );
  return rows.map((r) => ({
    id: r.id,
    ticketId: r.ticket_id,
    userId: r.user_id,
    userName: r.user_name,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: r.created_at,
  }));
}

/** Contagem por status, opcionalmente restrita a quem abriu ou a quem é responsável. */
export async function countByStatus(scope: { requesterId?: number; assigneeId?: number }) {
  const { sql, params } = buildWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.status, COUNT(*) AS total FROM tickets t ${sql} GROUP BY t.status`,
    params,
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.total)])) as Partial<Record<TicketStatus, number>>;
}

/**
 * Data de abertura (AAAA-MM-DD) do chamado mais antigo ainda "aberto" ou "em andamento";
 * null se não houver. requesterId restringe aos chamados de quem abriu.
 */
export async function oldestOpenTicketDate(requesterId?: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(MIN(t.created_at), '%Y-%m-%d') AS day
     FROM tickets t
     WHERE t.status IN ('aberto', 'em_andamento') ${requesterId === undefined ? "" : "AND t.requester_id = :requesterId"}`,
    { requesterId },
  );
  return rows[0]?.day ?? null;
}

/** Grava a avaliação; false se o chamado já tinha sido avaliado (corrida entre duas abas). */
export async function setRating(ticketId: number, rating: number, comment: string | null): Promise<boolean> {
  // updated_at = updated_at: avaliar não conta como atividade de atendimento.
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE tickets SET rating = ?, rating_comment = ?, rated_at = NOW(), updated_at = updated_at
     WHERE id = ? AND rating IS NULL`,
    [rating, comment, ticketId],
  );
  return result.affectedRows > 0;
}

/** Chamados "aberto" ou "em andamento" de quem abriu (para o limite por usuário). */
export async function countOpenTickets(requesterId: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM tickets WHERE requester_id = ? AND status IN ('aberto', 'em_andamento')",
    [requesterId],
  );
  return Number(rows[0]?.total ?? 0);
}
