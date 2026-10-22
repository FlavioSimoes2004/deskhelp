import { categoryExists } from "../models/categoryModel.js";
import * as tickets from "../models/ticketModel.js";
import type { AuthUser, Ticket, TicketPriority } from "../models/types.js";
import { findMachineById } from "../models/machineModel.js";
import { findUserById } from "../models/userModel.js";
import type { TicketQuery } from "../middlewares/schemas.js";
import type { UploadedFile } from "../middlewares/upload.js";
import { removeStored, resolveStored, saveFile } from "../utils/fileStorage.js";
import { forbidden, HttpError, notFound } from "../utils/httpError.js";
import { assignmentRecipient, commentRecipients } from "./notificationRules.js";
import { getSettings } from "./settingsService.js";
import { assertBelowOpenTicketLimit, assertCommentsOpen, hidesPriority } from "./settingsRules.js";
import {
  applySupportRules,
  assertCanAddComment,
  assertCanRate,
  assertCanSetSolution,
  assertMachineWhenResolved,
  canViewTicket,
  diffTicket,
  isStaff,
  statusTimestamps,
  type TicketEditableFields,
} from "./ticketRules.js";

async function getVisibleTicket(user: AuthUser, id: number): Promise<Ticket> {
  const ticket = await tickets.findTicketById(id);
  // 404 também para chamados de outra pessoa, para não revelar que existem.
  if (!ticket || !canViewTicket(user, ticket)) throw notFound("Chamado não encontrado");
  return ticket;
}

async function assertCategory(categoryId: number) {
  if (!(await categoryExists(categoryId))) {
    throw new HttpError(400, "VALIDATION_ERROR", "Categoria inválida", [
      { field: "categoryId", message: "Categoria inválida" },
    ]);
  }
}

/** Prioridade dada a chamados abertos por quem não pode escolhê-la (a mesma padrão do cadastro). */
const DEFAULT_PRIORITY: TicketPriority = "media";

/**
 * Chamado como o usuário pode vê-lo: sem prioridade quando a configuração esconde a
 * prioridade de usuários "comum".
 */
function present<T extends { priority: TicketPriority }>(ticket: T, hidePriority: boolean) {
  return hidePriority ? { ...ticket, priority: null } : { ...ticket, priority: ticket.priority as TicketPriority | null };
}

export async function listTickets(user: AuthUser, query: TicketQuery) {
  const hide = hidesPriority(user, await getSettings());
  const { page, pageSize, ...requested } = query;
  // Prioridade escondida: o filtro por prioridade também não vale (revelaria a prioridade).
  const filters = hide ? { ...requested, priority: undefined } : requested;
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new HttpError(400, "VALIDATION_ERROR", "A data inicial deve ser anterior à final", [
      { field: "from", message: "A data inicial deve ser anterior à final" },
    ]);
  }
  const scoped = isStaff(user.role) ? filters : { ...filters, requesterId: user.id };
  const { items, total } = await tickets.listTickets(scoped, page, pageSize);
  return { data: items.map((t) => present(t, hide)), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getTicketDetail(user: AuthUser, id: number) {
  const ticket = await getVisibleTicket(user, id);
  const [comments, history, settings] = await Promise.all([
    tickets.listComments(id, isStaff(user.role)),
    tickets.listHistory(id),
    getSettings(),
  ]);
  const hide = hidesPriority(user, settings);
  return {
    ...present(ticket, hide),
    comments,
    // O histórico também não mostra mudanças de prioridade a quem não pode vê-la.
    history: hide ? history.filter((h) => h.field !== "priority") : history,
  };
}

export async function createTicket(
  user: AuthUser,
  data: { title: string; description: string; priority: TicketPriority; categoryId: number },
) {
  await assertCategory(data.categoryId);
  const settings = await getSettings();
  assertBelowOpenTicketLimit(await tickets.countOpenTickets(user.id), settings);
  const hide = hidesPriority(user, settings);
  // Quem não vê a prioridade também não a escolhe: fica a padrão.
  const priority = hide ? DEFAULT_PRIORITY : data.priority;
  const id = await tickets.insertTicket({ ...data, priority, requesterId: user.id });
  return present(await getVisibleTicket(user, id), hide);
}

export async function updateTicket(user: AuthUser, id: number, requested: Partial<TicketEditableFields>) {
  const current = await getVisibleTicket(user, id);
  const patch = user.role === "support" ? applySupportRules(user, current, requested) : requested;
  if (patch.categoryId !== undefined) await assertCategory(patch.categoryId);
  if (patch.assigneeId != null) {
    const assignee = await findUserById(patch.assigneeId);
    if (!assignee || !isStaff(assignee.role) || !assignee.active) {
      throw new HttpError(400, "VALIDATION_ERROR", "O responsável precisa ser um administrador ou suporte ativo", [
        { field: "assigneeId", message: "O responsável precisa ser um administrador ou suporte ativo" },
      ]);
    }
  }
  if (patch.machineId != null && !(await findMachineById(patch.machineId))) {
    throw new HttpError(400, "VALIDATION_ERROR", "Máquina inválida", [{ field: "machineId", message: "Máquina inválida" }]);
  }
  assertMachineWhenResolved(current, patch);

  const changes = diffTicket(current, patch);
  if (changes.length === 0) return getTicketDetail(user, id);

  const statusChanged = changes.some((c) => c.field === "status");
  const timestamps = statusChanged && patch.status ? statusTimestamps(current, patch.status, new Date()) : {};
  const recipient = assignmentRecipient(user, current, patch);
  const notifications = recipient ? [{ userId: recipient, type: "assigned" as const, ticketId: id, actorId: user.id }] : [];
  await tickets.updateTicket(id, user.id, { ...patch, ...timestamps }, changes, notifications);
  return getTicketDetail(user, id);
}

/** Registra (ou remove, com null) a solução do chamado; a mudança entra no histórico. */
export async function setSolution(user: AuthUser, id: number, solution: string | null) {
  const current = await getVisibleTicket(user, id);
  assertCanSetSolution(user, current);
  const changes = diffTicket(current, { solution });
  if (changes.length > 0) await tickets.updateTicket(id, user.id, { solution }, changes);
  return getTicketDetail(user, id);
}

/** Quem abriu avalia o atendimento (1 a 5), com o chamado resolvido ou fechado, uma vez. */
export async function rateTicket(user: AuthUser, id: number, rating: number, comment: string | null) {
  const ticket = await getVisibleTicket(user, id);
  assertCanRate(user, ticket);
  if (!(await tickets.setRating(id, rating, comment))) {
    throw new HttpError(409, "ALREADY_RATED", "Este atendimento já foi avaliado");
  }
  return getTicketDetail(user, id);
}

/** Usuário comum marca o próprio chamado como resolvido. */
export async function resolveOwnTicket(user: AuthUser, id: number) {
  const current = await getVisibleTicket(user, id);
  if (user.role !== "comum" || current.requesterId !== user.id) {
    throw forbidden("Somente quem abriu o chamado pode marcá-lo como resolvido");
  }
  if (current.status === "resolvido" || current.status === "fechado") {
    throw new HttpError(409, "TICKET_ALREADY_RESOLVED", "Este chamado já está resolvido ou fechado");
  }
  const patch = { status: "resolvido" as const };
  if (current.machineId === null) {
    throw new HttpError(
      409,
      "MACHINE_REQUIRED",
      "O suporte precisa vincular a máquina a este chamado antes de ele ser marcado como resolvido",
    );
  }
  const timestamps = statusTimestamps(current, patch.status, new Date());
  await tickets.updateTicket(id, user.id, { ...patch, ...timestamps }, diffTicket(current, patch));
  return getTicketDetail(user, id);
}

const attachmentFolder = (ticketId: number) => `tickets/${ticketId}`;

export async function addComment(
  user: AuthUser,
  id: number,
  body: string,
  files: UploadedFile[] = [],
  internal = false,
) {
  const ticket = await getVisibleTicket(user, id);
  assertCommentsOpen(await getSettings());
  assertCanAddComment(user, ticket, internal);
  // Nota interna não avisa quem abriu, a não ser que seja da equipe.
  const requester = internal ? await findUserById(ticket.requesterId) : null;
  const recipients = commentRecipients(
    user.id,
    ticket,
    internal ? { requesterIsStaff: requester !== null && isStaff(requester.role) } : null,
  );
  const saved: tickets.NewAttachment[] = [];
  try {
    for (const file of files) {
      const filePath = await saveFile(attachmentFolder(id), file.extension, file.data);
      saved.push({ originalName: file.originalName, filePath, mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    }
    await tickets.insertComment(id, user.id, body, saved, recipients, internal);
  } catch (error) {
    // Não deixa arquivos órfãos se a gravação no banco falhar.
    await Promise.all(saved.map((f) => removeStored(f.filePath).catch(() => undefined)));
    throw error;
  }
  return getTicketDetail(user, id);
}

/** Localiza o arquivo de um anexo, respeitando quem pode ver o chamado. */
export async function getAttachmentFile(user: AuthUser, attachmentId: number) {
  const attachment = await tickets.findAttachmentById(attachmentId);
  // Anexo de nota interna: 404 para quem não é da equipe (não revela que existe).
  if (!attachment || (attachment.internal && !isStaff(user.role))) throw notFound("Anexo não encontrado");
  await getVisibleTicket(user, attachment.ticketId);
  return { path: resolveStored(attachment.filePath), name: attachment.originalName };
}

/** Data do chamado aberto/em andamento mais antigo que o usuário pode ver (padrão do filtro "De"). */
export function getOldestOpenDate(user: AuthUser) {
  return tickets.oldestOpenTicketDate(isStaff(user.role) ? undefined : user.id);
}

/** Resumo para a página inicial: admin e suporte veem o geral e o que está com eles; comum vê os próprios. */
export async function getOverview(user: AuthUser) {
  if (isStaff(user.role)) {
    const [all, assignedToMe] = await Promise.all([
      tickets.countByStatus({}),
      tickets.countByStatus({ assigneeId: user.id }),
    ]);
    return { byStatus: all, assignedToMe };
  }
  return { byStatus: await tickets.countByStatus({ requesterId: user.id }) };
}
