/**
 * Atualiza bancos antigos que ainda têm a tabela ticket_comments:
 * - os anexos passam a apontar para o chamado (ticket_id) em vez do comentário;
 * - os comentários viram linhas em tickets.comments, no formato com prefixo;
 * - a tabela ticket_comments é removida.
 * Chamado por migrate.ts; não faz nada em bancos já atualizados.
 */
import type mysql from "mysql2/promise";
import { appendCommentLine, buildCommentLine } from "../services/ticketComments.js";

async function exists(conn: mysql.Connection, sql: string, params: string[]): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

const tableExists = (conn: mysql.Connection, table: string) =>
  exists(conn, "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", [table]);

const columnExists = (conn: mysql.Connection, table: string, column: string) =>
  exists(
    conn,
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );

export async function upgradeComments(conn: mysql.Connection): Promise<void> {
  if (!(await tableExists(conn, "ticket_comments"))) return;

  // Anexos de cada comentário, antes de a ligação com o comentário sumir.
  const attachmentsByComment = new Map<number, number[]>();
  if (await columnExists(conn, "ticket_comment_attachments", "comment_id")) {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, comment_id FROM ticket_comment_attachments ORDER BY id",
    );
    for (const r of rows) {
      attachmentsByComment.set(r.comment_id, [...(attachmentsByComment.get(r.comment_id) ?? []), r.id]);
    }

    await conn.query("ALTER TABLE ticket_comment_attachments ADD COLUMN ticket_id INT UNSIGNED NULL AFTER id");
    await conn.query(
      `UPDATE ticket_comment_attachments a JOIN ticket_comments c ON c.id = a.comment_id
       SET a.ticket_id = c.ticket_id`,
    );
    await conn.query(
      `ALTER TABLE ticket_comment_attachments
         DROP FOREIGN KEY fk_attachments_comment,
         DROP INDEX idx_attachments_comment,
         DROP COLUMN comment_id,
         MODIFY ticket_id INT UNSIGNED NOT NULL,
         ADD KEY idx_attachments_ticket (ticket_id),
         ADD CONSTRAINT fk_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE`,
    );
  }

  // Monta o texto de cada chamado; se não couber, ficam as mensagens mais recentes.
  const [comments] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, ticket_id, user_id, body, created_at FROM ticket_comments ORDER BY ticket_id, created_at DESC, id DESC",
  );
  const linesByTicket = new Map<number, string[]>();
  for (const c of comments) {
    const lines = linesByTicket.get(c.ticket_id) ?? [];
    lines.unshift(
      buildCommentLine({
        at: c.created_at,
        userId: c.user_id,
        attachmentIds: attachmentsByComment.get(c.id) ?? [],
        body: c.body,
      }),
    );
    linesByTicket.set(c.ticket_id, lines);
  }

  let dropped = 0;
  for (const [ticketId, lines] of linesByTicket) {
    let text: string | null = null;
    // Do mais recente para o mais antigo, parando quando não couber mais.
    for (let i = lines.length - 1; i >= 0; i--) {
      const candidate: string | null = text === null ? appendCommentLine(null, lines[i]!) : appendCommentLine(lines[i]!, text);
      if (candidate === null) {
        dropped += i + 1;
        break;
      }
      text = candidate;
    }
    // updated_at = updated_at evita que a migração conte como atividade no chamado.
    await conn.execute(
      "UPDATE tickets SET comments = ?, updated_at = updated_at WHERE id = ? AND comments IS NULL",
      [text, ticketId],
    );
  }

  await conn.query("DROP TABLE ticket_comments");
  console.log(`Comentários movidos para tickets.comments (${comments.length - dropped} mensagens).`);
  if (dropped > 0) {
    console.warn(`${dropped} mensagens antigas não couberam nos 510 caracteres e foram descartadas.`);
  }
}
