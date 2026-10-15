/**
 * Comentários de um chamado ficam na coluna tickets.comments (VARCHAR(510)):
 * uma mensagem por linha, cada uma com o prefixo
 *   [AAAA-MM-DD HH:MM:SS, users:{id}, attachs:{id}|{id}] mensagem
 * Ex.: [2026-10-14 12:20:20, users:1, attachs:1|2|3|4] Segue o print do erro
 */

/** Tamanho da coluna tickets.comments, em caracteres. */
export const MAX_COMMENTS_LENGTH = 510;

export interface ParsedComment {
  /** Posição da mensagem no chamado (1, 2, 3...). */
  index: number;
  createdAt: Date;
  userId: number;
  attachmentIds: number[];
  body: string;
}

const LINE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}), users:(\d+), attachs:([\d|]*)\] ?(.*)$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** Data no horário local do servidor, como o MariaDB grava os demais DATETIME. */
export function formatCommentDate(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Quantidade de caracteres como o MariaDB conta (pontos de código, não unidades UTF-16). */
export const charLength = (text: string) => Array.from(text).length;

/** Monta a linha da mensagem; quebras de linha viram espaço, pois cada linha é uma mensagem. */
export function buildCommentLine(data: { at: Date; userId: number; attachmentIds: number[]; body: string }): string {
  const body = data.body.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return `[${formatCommentDate(data.at)}, users:${data.userId}, attachs:${data.attachmentIds.join("|")}] ${body}`;
}

/** Acrescenta a linha ao texto atual; devolve null se não couber na coluna. */
export function appendCommentLine(current: string | null, line: string): string | null {
  const next = current ? `${current}\n${line}` : line;
  return charLength(next) <= MAX_COMMENTS_LENGTH ? next : null;
}

/** Lê as mensagens da coluna; linhas fora do formato são ignoradas. */
export function parseComments(text: string | null): ParsedComment[] {
  if (!text) return [];
  const comments: ParsedComment[] = [];
  text.split("\n").forEach((line, i) => {
    const m = LINE.exec(line);
    if (!m) return;
    const [, y, mo, d, h, mi, s, userId, attachs, body] = m;
    comments.push({
      index: i + 1,
      createdAt: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
      userId: Number(userId),
      attachmentIds: attachs ? attachs.split("|").filter(Boolean).map(Number) : [],
      body: body ?? "",
    });
  });
  return comments;
}
