import type { AuthUser, TicketPriority, TicketStatus } from "../models/types.js";

/** Admin vê todos os chamados; usuário comum vê apenas os que abriu. */
export function canViewTicket(user: AuthUser, ticket: { requesterId: number }): boolean {
  return user.role === "admin" || ticket.requesterId === user.id;
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
