import type { AuthUser, Role, TicketPriority, TicketStatus } from "../models/types.js";
import { forbidden } from "../utils/httpError.js";

/** Equipe de atendimento: administradores e suporte. */
export const isStaff = (role: Role) => role === "admin" || role === "support";

/** Admin e suporte veem todos os chamados; usuário comum vê apenas os que abriu. */
export function canViewTicket(user: AuthUser, ticket: { requesterId: number }): boolean {
  return isStaff(user.role) || ticket.requesterId === user.id;
}

/** Somente quem abriu o chamado e o responsável por ele podem comentar. */
export function canComment(user: AuthUser, ticket: { requesterId: number; assigneeId: number | null }): boolean {
  return ticket.requesterId === user.id || ticket.assigneeId === user.id;
}

/**
 * Regras do perfil suporte ao alterar um chamado:
 * - altera prioridade e categoria;
 * - não altera assunto, descrição nem status;
 * - só assume para si um chamado sem responsável (e não troca o responsável existente).
 * Ao assumir um chamado "aberto", o status passa para "em_andamento", como no admin.
 * Devolve o patch a aplicar (com o status, quando for o caso).
 */
export function applySupportRules(
  user: AuthUser,
  current: { status: TicketStatus; assigneeId: number | null },
  patch: Partial<TicketEditableFields>,
): Partial<TicketEditableFields> {
  if (patch.title !== undefined || patch.description !== undefined) {
    throw forbidden("O suporte não pode alterar o assunto nem a descrição do chamado");
  }
  if (patch.status !== undefined) throw forbidden("O suporte não pode alterar o status do chamado");

  if (patch.assigneeId === undefined || patch.assigneeId === current.assigneeId) {
    const { assigneeId: _same, ...rest } = patch;
    return rest;
  }
  if (current.assigneeId !== null) throw forbidden("Este chamado já tem um responsável");
  if (patch.assigneeId !== user.id) throw forbidden("O suporte só pode assumir o chamado para si");
  return current.status === "aberto" ? { ...patch, status: "em_andamento" } : patch;
}

/**
 * Calcula resolvedAt/closedAt ao mudar de status:
 * - resolvido: marca a data de resolução (mantém a original se já existia)
 * - fechado: marca o fechamento e garante uma data de resolução
 * - qualquer outro status: o chamado foi (re)aberto, então limpa ambas
 */
export function statusTimestamps(
  current: { status: TicketStatus; resolvedAt: Date | null },
  next: TicketStatus,
  now: Date,
): { resolvedAt: Date | null; closedAt: Date | null } {
  if (next === "resolvido") return { resolvedAt: current.resolvedAt ?? now, closedAt: null };
  if (next === "fechado") return { resolvedAt: current.resolvedAt ?? now, closedAt: now };
  return { resolvedAt: null, closedAt: null };
}

export interface TicketEditableFields {
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId: number;
  assigneeId: number | null;
}

export interface TicketChange {
  field: keyof TicketEditableFields;
  oldValue: string | null;
  newValue: string | null;
}

const asText = (value: string | number | null): string | null => (value === null ? null : String(value));

/** Lista os campos que realmente mudam, para gravar no histórico. */
export function diffTicket(current: TicketEditableFields, patch: Partial<TicketEditableFields>): TicketChange[] {
  const changes: TicketChange[] = [];
  for (const field of Object.keys(patch) as (keyof TicketEditableFields)[]) {
    const next = patch[field];
    if (next === undefined || next === current[field]) continue;
    changes.push({ field, oldValue: asText(current[field]), newValue: asText(next) });
  }
  return changes;
}
