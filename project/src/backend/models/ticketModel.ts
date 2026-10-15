import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type SqlParams } from "../config/database.js";
import { appendCommentLine, buildCommentLine, charLength, parseComments } from "../services/ticketComments.js";
import type { TicketChange, TicketEditableFields } from "../services/ticketRules.js";
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
  SELECT t.*, c.name AS category_name, r.name AS requester_name, a.name AS assignee_name
  FROM tickets t
  JOIN categories c ON c.id = t.category_id
  JOIN users r ON r.id = t.requester_id
  LEFT JOIN users a ON a.id = t.assignee_id`;

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
};

/** Atualiza o chamado e grava o histórico na mesma transação. */
export async function updateTicket(
  id: number,
  userId: number,
  patch: Partial<TicketEditableFields> & { resolvedAt?: Date | null; closedAt?: Date | null },
  changes: TicketChange[],
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
  ticketId: r.ticket_id,
  originalName: r.original_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  createdAt: r.created_at,
});

/** Mensagens do chamado (de tickets.comments) e quantos caracteres a coluna já usa. */
export async function listComments(ticketId: number): Promise<{ items: TicketComment[]; used: number }> {
  const [ticketRows] = await pool.execute<RowDataPacket[]>("SELECT comments FROM tickets WHERE id = ?", [ticketId]);
  const text: string | null = ticketRows[0]?.comments ?? null;
  const parsed = parseComments(text);
  if (parsed.length === 0) return { items: [], used: text ? charLength(text) : 0 };

  const userIds = [...new Set(parsed.map((c) => c.userId))];
  const [userRows] = await pool.query<RowDataPacket[]>("SELECT id, name FROM users WHERE id IN (?)", [userIds]);
  const userName = new Map<number, string>(userRows.map((r) => [r.id, r.name]));

  // Só anexos do próprio chamado, mesmo que o prefixo cite outro id.
  const [attachmentRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, ticket_id, original_name, mime_type, size_bytes, created_at
     FROM ticket_comment_attachments WHERE ticket_id = ?`,
    [ticketId],
  );
  const attachment = new Map<number, TicketAttachment>(attachmentRows.map((r) => [r.id, toAttachment(r)]));

  const items = parsed.map((c) => ({
    id: c.index,
    ticketId,
    userId: c.userId,
    userName: userName.get(c.userId) ?? `Usuário #${c.userId}`,
    body: c.body,
    createdAt: c.createdAt,
    attachments: c.attachmentIds.flatMap((id) => attachment.get(id) ?? []),
  }));
  return { items, used: text ? charLength(text) : 0 };
}

export interface NewAttachment {
  originalName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Grava os anexos (já salvos em disco) e acrescenta a mensagem, com os ids
 * deles no prefixo, a tickets.comments, tudo na mesma transação. Devolve
 * false, sem gravar nada, se a mensagem não couber na coluna.
 */
export async function insertComment(
  ticketId: number,
  userId: number,
  body: string,
  attachments: NewAttachment[] = [],
): Promise<boolean> {
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Trava a linha para que duas mensagens simultâneas não se sobrescrevam.
    const [rows] = await conn.execute<RowDataPacket[]>("SELECT comments FROM tickets WHERE id = ? FOR UPDATE", [
      ticketId,
    ]);
    const attachmentIds: number[] = [];
    for (const file of attachments) {
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO ticket_comment_attachments (ticket_id, original_name, file_path, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?)`,
        [ticketId, file.originalName, file.filePath, file.mimeType, file.sizeBytes],
      );
      attachmentIds.push(result.insertId);
    }
    const line = buildCommentLine({ at: new Date(), userId, attachmentIds, body });
    const next = appendCommentLine(rows[0]?.comments ?? null, line);
    if (next === null) {
      await conn.rollback();
      return false;
    }
    // updated_at muda junto: comentar também conta como atividade no chamado.
    await conn.execute("UPDATE tickets SET comments = ? WHERE id = ?", [next, ticketId]);
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function findAttachmentById(id: number): Promise<StoredAttachment | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, ticket_id, original_name, file_path, mime_type, size_bytes, created_at
     FROM ticket_comment_attachments WHERE id = ?`,
    [id],
  );
  const r = rows[0];
  return r ? { ...toAttachment(r), filePath: r.file_path } : null;
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
