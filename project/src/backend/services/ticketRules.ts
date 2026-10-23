import type { AuthUser, TicketPriority, TicketStatus } from "../models/types.js";
import { forbidden, HttpError } from "../utils/httpError.js";
import { isStaff, isSuper } from "./roleRules.js";

export { isStaff } from "./roleRules.js";

/** Suporte e super suporte veem todos os chamados; comum e admin, apenas os que abriram. */
export function canViewTicket(user: AuthUser, ticket: { requesterId: number }): boolean {
  return isStaff(user.role) || ticket.requesterId === user.id;
}

/** Somente quem abriu o chamado e o responsável por ele podem comentar. */
export function canComment(user: AuthUser, ticket: { requesterId: number; assigneeId: number | null }): boolean {
  return ticket.requesterId === user.id || ticket.assigneeId === user.id;
}

/**
 * Pode enviar o comentário? Comentário normal: quem abriu ou o responsável. Nota interna
 * (visível só para a equipe): qualquer suporte ou super suporte. Em chamado fechado, só super suporte.
 */
export function assertCanAddComment(
  user: AuthUser,
  ticket: { requesterId: number; assigneeId: number | null; status: TicketStatus },
  internal: boolean,
): void {
  if (internal ? !isStaff(user.role) : !canComment(user, ticket)) {
    throw forbidden(
      internal
        ? "Somente administradores e suporte podem escrever notas internas"
        : "Somente quem abriu o chamado e o responsável por ele podem comentar",
    );
  }
  if (!isSuper(user.role) && ticket.status === "fechado") {
    throw new HttpError(409, "TICKET_CLOSED", "Este chamado está fechado e não aceita novos comentários");
  }
}

/** Avaliação do atendimento: só quem abriu, com o chamado resolvido ou fechado, uma vez. */
export function assertCanRate(
  user: AuthUser,
  ticket: { requesterId: number; status: TicketStatus; rating: number | null },
): void {
  if (ticket.requesterId !== user.id) throw forbidden("Somente quem abriu o chamado pode avaliar o atendimento");
  if (ticket.status !== "resolvido" && ticket.status !== "fechado") {
    throw new HttpError(409, "TICKET_NOT_RESOLVED", "O atendimento só pode ser avaliado com o chamado resolvido ou fechado");
  }
  if (ticket.rating !== null) throw new HttpError(409, "ALREADY_RATED", "Este atendimento já foi avaliado");
}

/**
 * Regras do perfil suporte ao alterar um chamado:
 * - altera prioridade, categoria e a máquina vinculada;
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
  priority: TicketPriority | null;
  categoryId: number;
  assigneeId: number | null;
  machineId: number | null;
  solution: string | null;
}

/**
 * Quem registra a solução: o responsável pelo chamado ou um super suporte, e só com o
 * chamado "resolvido".
 */
export function assertCanSetSolution(
  user: AuthUser,
  ticket: { status: TicketStatus; assigneeId: number | null },
): void {
  if (!isSuper(user.role) && ticket.assigneeId !== user.id) {
    throw forbidden("Somente o responsável pelo chamado ou um administrador pode registrar a solução");
  }
  if (ticket.status !== "resolvido") {
    throw new HttpError(409, "TICKET_NOT_RESOLVED", "A solução só pode ser registrada com o chamado resolvido");
  }
}

/**
 * Chamado "resolvido" precisa ter máquina vinculada. Confere o estado final quando
 * a alteração muda de fato o status ou a máquina, assim chamados antigos sem máquina
 * podem ter outros campos editados normalmente.
 */
export function assertMachineWhenResolved(
  current: { status: TicketStatus; machineId: number | null },
  patch: Partial<Pick<TicketEditableFields, "status" | "machineId">>,
): void {
  const statusChanges = patch.status !== undefined && patch.status !== current.status;
  const machineChanges = patch.machineId !== undefined && patch.machineId !== current.machineId;
  if (!statusChanges && !machineChanges) return;
  const status = patch.status ?? current.status;
  const machineId = patch.machineId !== undefined ? patch.machineId : current.machineId;
  if (status === "resolvido" && machineId === null) {
    const message = "Vincule a máquina ao chamado antes de marcá-lo como resolvido";
    throw new HttpError(400, "MACHINE_REQUIRED", message, [{ field: "machineId", message }]);
  }
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
