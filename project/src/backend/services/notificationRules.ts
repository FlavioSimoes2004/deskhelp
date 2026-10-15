import type { AuthUser } from "../models/types.js";

/**
 * Quem recebe a notificação de atribuição: o novo responsável, quando um admin
 * atribui o chamado a outra pessoa. Assumir o chamado para si não notifica.
 */
export function assignmentRecipient(
  actor: AuthUser,
  current: { assigneeId: number | null },
  patch: { assigneeId?: number | null },
): number | null {
  if (actor.role !== "admin") return null;
  const next = patch.assigneeId;
  if (next == null || next === current.assigneeId || next === actor.id) return null;
  return next;
}

/** Quem recebe a notificação de comentário: quem abriu e o responsável, exceto o autor. */
export function commentRecipients(
  authorId: number,
  ticket: { requesterId: number; assigneeId: number | null },
): number[] {
  const ids = new Set([ticket.requesterId, ticket.assigneeId]);
  return [...ids].filter((id): id is number => id !== null && id !== authorId);
}
