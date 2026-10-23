import type { AuthUser } from "../models/types.js";
import { HttpError } from "../utils/httpError.js";
import { isRequesterOnly } from "./roleRules.js";

export interface AppSettings {
  /** Usuários comuns (e admins, que seguem as regras do comum) não veem nem escolhem a prioridade. */
  hidePriorityForComum: boolean;
  /** Usuários comuns (e admins) abrem chamados sem prioridade; o suporte define depois. */
  priorityByStaffOnly: boolean;
  /** Suporte não cria nem edita usuários (só super suporte). */
  blockSupportUserManagement: boolean;
  /** Ninguém consegue enviar comentários (nem notas internas). */
  commentsLocked: boolean;
  /** Máximo de chamados "aberto"/"em andamento" por usuário; null = sem limite. */
  maxOpenTicketsPerUser: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hidePriorityForComum: false,
  priorityByStaffOnly: false,
  blockSupportUserManagement: false,
  commentsLocked: false,
  maxOpenTicketsPerUser: null,
};

/** Nome de cada configuração na tabela app_settings. */
export const SETTING_KEYS: Record<keyof AppSettings, string> = {
  hidePriorityForComum: "hide_priority_for_comum",
  priorityByStaffOnly: "priority_by_staff_only",
  blockSupportUserManagement: "block_support_user_management",
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
    priorityByStaffOnly: bool("priorityByStaffOnly"),
    blockSupportUserManagement: bool("blockSupportUserManagement"),
    commentsLocked: bool("commentsLocked"),
    maxOpenTicketsPerUser: Number.isInteger(limit) && limit > 0 ? limit : null,
  };
}

/** Converte para o texto gravado na tabela. */
export function serializeSetting(value: AppSettings[keyof AppSettings]): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return value === null ? "0" : String(value);
}

/**
 * Prioridade de um chamado novo: sem prioridade quando só o suporte a define; a padrão
 * quando a prioridade está escondida; senão, a escolhida. Vale para comum e admin.
 */
export function newTicketPriority<P>(user: AuthUser, settings: AppSettings, chosen: P, fallback: P): P | null {
  if (!isRequesterOnly(user.role)) return chosen;
  if (settings.priorityByStaffOnly) return null;
  if (settings.hidePriorityForComum) return fallback;
  return chosen;
}

export const hidesPriority = (user: AuthUser, settings: AppSettings) =>
  settings.hidePriorityForComum && isRequesterOnly(user.role);

/** Com a configuração ligada, só super suporte cria e edita usuários. */
export function assertCanWriteUsers(user: AuthUser, settings: AppSettings): void {
  if (user.role === "support" && settings.blockSupportUserManagement) {
    throw new HttpError(403, "FORBIDDEN", "O cadastro e a edição de usuários estão restritos ao super suporte");
  }
}

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
