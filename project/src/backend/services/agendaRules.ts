/** Data e hora local no formato do campo do formulário: AAAA-MM-DDTHH:MM. */
export const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Converte AAAA-MM-DDTHH:MM (horário local do servidor) em Date; null se inválida. */
export function parseLocalDateTime(value: string): Date | null {
  const m = LOCAL_DATETIME.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  const date = new Date(y!, mo! - 1, d!, h!, mi!, 0);
  // Recusa datas que o Date "corrige" (ex.: 31 de fevereiro, 25:00).
  if (date.getFullYear() !== y || date.getMonth() !== mo! - 1 || date.getDate() !== d || date.getHours() !== h) {
    return null;
  }
  return date;
}

/** Um minuto de folga: um lembrete marcado para "agora" ainda é aceito. */
const SLACK_MS = 60_000;

export const isNotInPast = (date: Date, now: Date) => date.getTime() >= now.getTime() - SLACK_MS;
