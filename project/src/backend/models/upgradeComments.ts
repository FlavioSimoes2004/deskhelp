/**
 * Atualiza bancos de versões anteriores para o esquema atual de comentários
 * (tabela ticket_comments com a coluna attachments = "1, 2, 10"):
 * - versão com tickets.comments (uma mensagem por linha, com o prefixo
 *   [AAAA-MM-DD HH:MM:SS, users:{id}, attachs:{id}|{id}]): cada linha vira uma
 *   linha em ticket_comments e a coluna tickets.comments é removida;
 * - versão com ticket_comment_attachments.comment_id: os ids dos anexos vão
 *   para ticket_comments.attachments e o anexo passa a apontar para o chamado.
 * Chamado por migrate.ts depois do schema.sql; não faz nada em bancos já atualizados.
 */
import type mysql from "mysql2/promise";
import { formatAttachmentIds } from "../services/ticketComments.js";

async function exists(conn: mysql.Connection, sql: string, params: string[]): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

const columnExists = (conn: mysql.Connection, table: string, column: string) =>
  exists(
    conn,
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );

const LEGACY_LINE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}), users:(\d+), attachs:([\d|]*)\] ?(.*)$/;

/** Versão com a tabela ticket_comments sem a coluna attachments e anexos ligados por comment_id. */
async function fromCommentIdAttachments(conn: mysql.Connection) {
  if (!(await columnExists(conn, "ticket_comments", "attachments"))) {
    await conn.query("ALTER TABLE ticket_comments ADD COLUMN attachments VARCHAR(125) NULL AFTER body");
  }
  if (!(await columnExists(conn, "ticket_comment_attachments", "comment_id"))) return;

  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, comment_id FROM ticket_comment_attachments ORDER BY id",
  );
  const byComment = new Map<number, number[]>();
  for (const r of rows) byComment.set(r.comment_id, [...(byComment.get(r.comment_id) ?? []), r.id]);
  for (const [commentId, ids] of byComment) {
    await conn.execute("UPDATE ticket_comments SET attachments = ? WHERE id = ?", [formatAttachmentIds(ids), commentId]);
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
  console.log("Anexos ligados aos comentários pela coluna ticket_comments.attachments.");
}

/** Versão com as mensagens na coluna tickets.comments. */
async function fromTicketsColumn(conn: mysql.Connection) {
  if (!(await columnExists(conn, "tickets", "comments"))) return;

  const [tickets] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id, comments FROM tickets WHERE comments IS NOT NULL AND comments <> ''",
  );
  let moved = 0;
  let skipped = 0;
  // Se alguma inserção falhar, nada fica pela metade e o migrate pode ser rodado de novo.
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
        const ids = attachs ? attachs.split("|").filter(Boolean).map(Number) : [];
        await conn.execute(
          "INSERT INTO ticket_comments (ticket_id, user_id, body, attachments, created_at) VALUES (?, ?, ?, ?, ?)",
          [t.id, Number(userId), body ?? "", formatAttachmentIds(ids), `${y}-${mo}-${d} ${h}:${mi}:${s}`],
        );
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

export async function upgradeComments(conn: mysql.Connection): Promise<void> {
  await fromCommentIdAttachments(conn);
  await fromTicketsColumn(conn);
}
