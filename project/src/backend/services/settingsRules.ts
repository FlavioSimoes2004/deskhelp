import type { AuthUser } from "../models/types.js";
import { HttpError } from "../utils/httpError.js";

export interface AppSettings {
  /** Usuários "comum" não veem (nem escolhem) a prioridade dos chamados. */
  hidePriorityForComum: boolean;
  /** Ninguém consegue enviar comentários (nem notas internas). */
  commentsLocked: boolean;
  /** Máximo de chamados "aberto"/"em andamento" por usuário; null = sem limite. */
  maxOpenTicketsPerUser: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hidePriorityForComum: false,
  commentsLocked: false,
  maxOpenTicketsPerUser: null,
};

/** Nome de cada configuração na tabela app_settings. */
export const SETTING_KEYS: Record<keyof AppSettings, string> = {
  hidePriorityForComum: "hide_priority_for_comum",
  commentsLocked: "comments_locked",
  maxOpenTicketsPerUser: "max_open_tickets_per_user",
};

/** Lê as linhas da tabela (chave -> texto); o que faltar ou for inválido usa o padrão. */
export function parseSettings(rows: Record<string, string>): AppSettings {
  const bool = (key: keyof AppSettings) => {
    const value = rows[SETTING_KEYS[key]];
    return value === undefined ? (DEFAULT_SETTINGS[key] as boolean) : value === "1";
  };
  const limit = Number(rows[SETTING_KEYS.maxOpenTicketsPerUser]);
  return {
    hidePriorityForComum: bool("hidePriorityForComum"),
    commentsLocked: bool("commentsLocked"),
    maxOpenTicketsPerUser: Number.isInteger(limit) && limit > 0 ? limit : null,
  };
}

/** Converte para o texto gravado na tabela. */
export function serializeSetting(value: AppSettings[keyof AppSettings]): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return value === null ? "0" : String(value);
}

export const hidesPriority = (user: AuthUser, settings: AppSettings) =>
  settings.hidePriorityForComum && user.role === "comum";

export function assertCommentsOpen(settings: AppSettings): void {
  if (settings.commentsLocked) {
    throw new HttpError(409, "COMMENTS_LOCKED", "A conversa nos chamados está bloqueada pela administração");
  }
}

export function assertBelowOpenTicketLimit(openTickets: number, settings: AppSettings): void {
  const limit = settings.maxOpenTicketsPerUser;
  if (limit !== null && openTickets >= limit) {
    throw new HttpError(
      409,
      "OPEN_TICKET_LIMIT",
      `Você já tem ${openTickets} ${openTickets === 1 ? "chamado" : "chamados"} aberto(s) ou em andamento; o limite é ${limit}. Aguarde a conclusão de algum para abrir outro.`,
    );
  }
}
