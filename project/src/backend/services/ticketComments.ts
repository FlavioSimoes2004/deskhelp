/**
 * A coluna ticket_comments.attachments (VARCHAR(125)) guarda os ids de
 * ticket_comment_attachments enviados com o comentário, no formato "1, 2, 10".
 */

/** Tamanho da coluna ticket_comments.attachments, em caracteres. */
export const MAX_ATTACHMENT_IDS_LENGTH = 125;

/** Monta o valor da coluna; null quando o comentário não tem anexos. */
export function formatAttachmentIds(ids: number[]): string | null {
  if (ids.length === 0) return null;
  const text = ids.join(", ");
  if (text.length > MAX_ATTACHMENT_IDS_LENGTH) {
    throw new Error(`Lista de anexos maior que ${MAX_ATTACHMENT_IDS_LENGTH} caracteres: ${text}`);
  }
  return text;
}

/** Lê os ids da coluna, ignorando espaços e itens vazios ou inválidos. */
export function parseAttachmentIds(text: string | null): number[] {
  if (!text) return [];
  return text
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}
