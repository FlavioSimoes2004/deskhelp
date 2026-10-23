/**
 * Atualiza bancos de versões anteriores para o esquema atual de comentários:
 * ticket_comment_attachments com comment_id (-> ticket_comments) e ticket_id (-> tickets).
 * Versões tratadas:
 * - ticket_comments.attachments ("1, 2, 10"): os ids viram comment_id nos anexos e a coluna sai;
 * - tickets.comments (uma mensagem por linha, com o prefixo
 *   [AAAA-MM-DD HH:MM:SS, users:{id}, attachs:{id}|{id}]): cada linha vira um registro em
 *   ticket_comments, os anexos citados recebem o comment_id e a coluna sai;
 * - anexos só com comment_id (sem ticket_id): ticket_id é preenchido pelo comentário.
 * Chamado por migrate.ts depois do schema.sql; não faz nada em bancos já atualizados.
 */
import type mysql from "mysql2/promise";

type Conn = mysql.Connection;

async function exists(conn: Conn, sql: string, params: string[]): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

const columnExists = (conn: Conn, table: string, column: string) =>
  exists(
    conn,
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );

const columnNullable = (conn: Conn, table: string, column: string) =>
  exists(
    conn,
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? AND is_nullable = 'YES'`,
    [table, column],
  );

export const indexExists = (conn: Conn, table: string, index: string) =>
  exists(
    conn,
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
    [table, index],
  );

export const foreignKeyExists = (conn: Conn, table: string, name: string) =>
  exists(
    conn,
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'FOREIGN KEY'`,
    [table, name],
  );

/** Liga os anexos citados ao comentário (só anexos do mesmo chamado). */
async function linkAttachments(conn: Conn, commentId: number, ticketId: number, ids: number[]) {
  if (ids.length === 0) return;
  await conn.query("UPDATE ticket_comment_attachments SET comment_id = ? WHERE ticket_id = ? AND id IN (?)", [
    commentId,
    ticketId,
    ids,
  ]);
}

const LEGACY_LINE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}), users:(\d+), attachs:([\d|]*)\] ?(.*)$/;

/** Versão com as mensagens na coluna tickets.comments. */
async function fromTicketsColumn(conn: Conn) {
  if (!(await columnExists(conn, "tickets", "comments"))) return;

  const [tickets] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, comments FROM tickets WHERE comments IS NOT NULL AND comments <> ''",
  );
  let moved = 0;
  let skipped = 0;
  // Se alguma gravação falhar, nada fica pela metade e o migrate pode ser rodado de novo.
  await conn.beginTransaction();
  try {
    for (const t of tickets) {
      for (const line of String(t.comments).split("\n")) {
        const m = LEGACY_LINE.exec(line);
        if (!m) {
          if (line.trim()) skipped++;
          continue;
        }
        const [, y, mo, d, h, mi, s, userId, attachs, body] = m;
        const [result] = await conn.execute<mysql.ResultSetHeader>(
          "INSERT INTO ticket_comments (ticket_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
          [t.id, Number(userId), body ?? "", `${y}-${mo}-${d} ${h}:${mi}:${s}`],
        );
        const ids = attachs ? attachs.split("|").filter(Boolean).map(Number) : [];
        await linkAttachments(conn, result.insertId, t.id, ids);
        moved++;
      }
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }

  await conn.query("ALTER TABLE tickets DROP COLUMN comments");
  console.log(`Comentários movidos de tickets.comments para ticket_comments (${moved} mensagens).`);
  if (skipped > 0) console.warn(`${skipped} linhas fora do formato esperado não foram migradas.`);
}

/** Versão com os ids dos anexos na coluna ticket_comments.attachments ("1, 2, 10"). */
async function fromAttachmentsColumn(conn: Conn) {
  if (!(await columnExists(conn, "ticket_comments", "attachments"))) return;

  const [comments] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, ticket_id, attachments FROM ticket_comments WHERE attachments IS NOT NULL AND attachments <> ''",
  );
  await conn.beginTransaction();
  try {
    for (const c of comments) {
      const ids = String(c.attachments)
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      await linkAttachments(conn, c.id, c.ticket_id, ids);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }

  await conn.query("ALTER TABLE ticket_comments DROP COLUMN attachments");
  console.log("Anexos ligados aos comentários por ticket_comment_attachments.comment_id.");
}

/** Garante índice e chave estrangeira de comment_id e ticket_id (ticket_id obrigatório). */
async function finalizeAttachments(conn: Conn) {
  // comment_id NULL é válido: anexo do próprio chamado (enviado ao abri-lo). Não remove nem
  // torna a coluna obrigatória.
  if (!(await indexExists(conn, "ticket_comment_attachments", "idx_attachments_comment"))) {
    await conn.query("ALTER TABLE ticket_comment_attachments ADD KEY idx_attachments_comment (comment_id)");
  }
  if (!(await foreignKeyExists(conn, "ticket_comment_attachments", "fk_attachments_comment"))) {
    await conn.query(
      `ALTER TABLE ticket_comment_attachments ADD CONSTRAINT fk_attachments_comment
       FOREIGN KEY (comment_id) REFERENCES ticket_comments (id) ON DELETE CASCADE`,
    );
  }

  if (await columnNullable(conn, "ticket_comment_attachments", "ticket_id")) {
    await conn.query("ALTER TABLE ticket_comment_attachments MODIFY ticket_id INT UNSIGNED NOT NULL");
  }
  if (!(await indexExists(conn, "ticket_comment_attachments", "idx_attachments_ticket"))) {
    await conn.query("ALTER TABLE ticket_comment_attachments ADD KEY idx_attachments_ticket (ticket_id)");
  }
  if (!(await foreignKeyExists(conn, "ticket_comment_attachments", "fk_attachments_ticket"))) {
    await conn.query(
      `ALTER TABLE ticket_comment_attachments ADD CONSTRAINT fk_attachments_ticket
       FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE`,
    );
  }
}

export async function upgradeComments(conn: Conn): Promise<void> {
  // Colunas que faltam em versões anteriores entram como opcionais e são preenchidas abaixo.
  if (!(await columnExists(conn, "ticket_comment_attachments", "comment_id"))) {
    await conn.query("ALTER TABLE ticket_comment_attachments ADD COLUMN comment_id INT UNSIGNED NULL AFTER id");
  }
  if (!(await columnExists(conn, "ticket_comment_attachments", "ticket_id"))) {
    await conn.query("ALTER TABLE ticket_comment_attachments ADD COLUMN ticket_id INT UNSIGNED NULL AFTER comment_id");
    await conn.query(
      `UPDATE ticket_comment_attachments a JOIN ticket_comments c ON c.id = a.comment_id
       SET a.ticket_id = c.ticket_id`,
    );
  }

  await fromTicketsColumn(conn);
  await fromAttachmentsColumn(conn);
  await finalizeAttachments(conn);
}
