import type { AuthUser } from "../models/types.js";
import { isSuper } from "./roleRules.js";

/**
 * Quem recebe a notificação de atribuição: o novo responsável, quando um super suporte
 * atribui o chamado a outra pessoa. Assumir o chamado para si não notifica.
 */
export function assignmentRecipient(
  actor: AuthUser,
  current: { assigneeId: number | null },
  patch: { assigneeId?: number | null },
): number | null {
  if (!isSuper(actor.role)) return null;
  const next = patch.assigneeId;
  if (next == null || next === current.assigneeId || next === actor.id) return null;
  return next;
}

/**
 * Quem recebe a notificação de comentário: quem abriu e o responsável, exceto o autor.
 * Nota interna não avisa quem abriu, a não ser que seja da equipe (admin/suporte).
 */
export function commentRecipients(
  authorId: number,
  ticket: { requesterId: number; assigneeId: number | null },
  internal: { requesterIsStaff: boolean } | null = null,
): number[] {
  const requester = internal && !internal.requesterIsStaff ? null : ticket.requesterId;
  const ids = new Set([requester, ticket.assigneeId]);
  return [...ids].filter((id): id is number => id !== null && id !== authorId);
}
