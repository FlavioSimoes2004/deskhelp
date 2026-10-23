import { findCategoryById } from "../models/categoryModel.js";
import * as tickets from "../models/ticketModel.js";
import type { AuthUser, Ticket, TicketPriority } from "../models/types.js";
import { findMachineById } from "../models/machineModel.js";
import { findUserById } from "../models/userModel.js";
import type { TicketQuery } from "../middlewares/schemas.js";
import type { UploadedFile } from "../middlewares/upload.js";
import { removeStored, resolveStored, saveFile } from "../utils/fileStorage.js";
import { forbidden, HttpError, notFound } from "../utils/httpError.js";
import { assignmentRecipient, commentRecipients } from "./notificationRules.js";
import { canViewAllTickets, isRequesterOnly } from "./roleRules.js";
import { getSettings } from "./settingsService.js";
import {
  assertBelowOpenTicketLimit,
  assertCommentsOpen,
  assertRatingsOpen,
  assertTicketAttachmentsAllowed,
  hidesPriority,
  newTicketPriority,
} from "./settingsRules.js";
import {
  applySupportRules,
  assertCanAddComment,
  assertCanConfirmSolution,
  assertCanReopen,
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

/** Categoria que pode ser escolhida: existe e está ativa. */
async function assertCategory(categoryId: number) {
  const category = await findCategoryById(categoryId);
  if (!category || !category.active) {
    const message = category ? "Esta categoria está desativada" : "Categoria inválida";
    throw new HttpError(400, "VALIDATION_ERROR", message, [{ field: "categoryId", message }]);
  }
}

/** Prioridade dada a chamados abertos por quem não pode escolhê-la (a mesma padrão do cadastro). */
const DEFAULT_PRIORITY: TicketPriority = "media";

/**
 * Chamado como o usuário pode vê-lo: sem prioridade quando a configuração esconde a
 * prioridade de usuários "comum".
 */
function present<T extends { priority: TicketPriority | null }>(ticket: T, hidePriority: boolean): T {
  return hidePriority ? { ...ticket, priority: null } : ticket;
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
  const scoped = canViewAllTickets(user.role) ? filters : { ...filters, requesterId: user.id };
  const { items, total } = await tickets.listTickets(scoped, page, pageSize);
  return { data: items.map((t) => present(t, hide)), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getTicketDetail(user: AuthUser, id: number) {
  const ticket = await getVisibleTicket(user, id);
  const [comments, history, settings, attachments] = await Promise.all([
    tickets.listComments(id, isStaff(user.role)),
    tickets.listHistory(id),
    getSettings(),
    tickets.listTicketAttachments(id),
  ]);
  const hide = hidesPriority(user, settings);
  return {
    ...present(ticket, hide),
    /** Anexos enviados ao abrir o chamado. */
    attachments,
    comments,
    // O histórico também não mostra mudanças de prioridade a quem não pode vê-la.
    history: hide ? history.filter((h) => h.field !== "priority") : history,
  };
}

export async function createTicket(
  user: AuthUser,
  data: { title: string; description: string; priority: TicketPriority; categoryId: number },
  files: UploadedFile[] = [],
) {
  await assertCategory(data.categoryId);
  const settings = await getSettings();
  assertBelowOpenTicketLimit(await tickets.countOpenTickets(user.id), settings);
  const hide = hidesPriority(user, settings);
  // Usuário comum: sem prioridade quando só o suporte define; a padrão quando ela está escondida.
  const priority = newTicketPriority(user, settings, data.priority, DEFAULT_PRIORITY);
  assertTicketAttachmentsAllowed(files.length, settings);

  // Arquivos primeiro (ainda sem id do chamado); o chamado e os anexos entram juntos no banco.
  const saved: tickets.NewAttachment[] = [];
  let id: number;
  try {
    for (const file of files) {
      const filePath = await saveFile(NEW_TICKET_FOLDER, file.extension, file.data);
      saved.push({ originalName: file.originalName, filePath, mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    }
    id = await tickets.insertTicket({ ...data, priority, requesterId: user.id }, saved);
  } catch (error) {
    // Não deixa arquivos órfãos se o chamado não foi criado.
    await Promise.all(saved.map((f) => removeStored(f.filePath).catch(() => undefined)));
    throw error;
  }
  return present(await getVisibleTicket(user, id), hide);
}

export async function updateTicket(user: AuthUser, id: number, requested: Partial<TicketEditableFields>) {
  const current = await getVisibleTicket(user, id);
  const patch = user.role === "support" ? applySupportRules(user, current, requested) : requested;
  // Manter a categoria atual vale mesmo que ela tenha sido desativada; trocar, só por uma ativa.
  if (patch.categoryId !== undefined && patch.categoryId !== current.categoryId) await assertCategory(patch.categoryId);
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
/**
 * Responsável (ou super suporte) registra, altera ou remove a solução, em qualquer status.
 * Toda mudança volta a pedir a confirmação de quem abriu, que é avisado.
 */
export async function setSolution(user: AuthUser, id: number, solution: string | null) {
  const current = await getVisibleTicket(user, id);
  assertCanSetSolution(user, current, solution);
  const changes = diffTicket(current, { solution });
  if (changes.length > 0) {
    const notify =
      solution !== null && current.requesterId !== user.id
        ? [{ userId: current.requesterId, type: "solution" as const, ticketId: id, actorId: user.id }]
        : [];
    await tickets.updateTicket(id, user.id, { solution, solutionConfirmedAt: null }, changes, notify);
  }
  return getTicketDetail(user, id);
}

/** Quem abriu confirma a solução: o chamado fica "resolvido" (se ainda não estava resolvido/fechado). */
export async function confirmSolution(user: AuthUser, id: number) {
  const current = await getVisibleTicket(user, id);
  assertCanConfirmSolution(user, current);
  const now = new Date();
  const finished = current.status === "resolvido" || current.status === "fechado";
  const patch = finished ? {} : { status: "resolvido" as const };
  if (!finished) assertMachineWhenResolved(current, patch);
  const timestamps = finished ? {} : statusTimestamps(current, "resolvido", now);
  await tickets.updateTicket(id, user.id, { ...patch, ...timestamps, solutionConfirmedAt: now }, diffTicket(current, patch));
  return getTicketDetail(user, id);
}

/** Quem abriu reabre o chamado resolvido (volta para "em andamento"), dentro do prazo configurado. */
export async function reopenTicket(user: AuthUser, id: number) {
  const current = await getVisibleTicket(user, id);
  assertCanReopen(user, current, (await getSettings()).reopenWindowHours, new Date());
  const patch = { status: "em_andamento" as const };
  const timestamps = statusTimestamps(current, patch.status, new Date());
  // A solução continua registrada, mas deixa de estar confirmada; o responsável é avisado.
  const notify =
    current.assigneeId !== null && current.assigneeId !== user.id
      ? [{ userId: current.assigneeId, type: "reopened" as const, ticketId: id, actorId: user.id }]
      : [];
  await tickets.updateTicket(
    id,
    user.id,
    { ...patch, ...timestamps, solutionConfirmedAt: null },
    diffTicket(current, patch),
    notify,
  );
  return getTicketDetail(user, id);
}

/** Quem abriu avalia o atendimento (1 a 5), com o chamado resolvido ou fechado, uma vez. */
export async function rateTicket(user: AuthUser, id: number, rating: number, comment: string | null) {
  const ticket = await getVisibleTicket(user, id);
  assertRatingsOpen(await getSettings());
  assertCanRate(user, ticket);
  if (!(await tickets.setRating(id, rating, comment))) {
    throw new HttpError(409, "ALREADY_RATED", "Este atendimento já foi avaliado");
  }
  return getTicketDetail(user, id);
}

/** Quem abriu (comum ou admin) marca o próprio chamado como resolvido. */
export async function resolveOwnTicket(user: AuthUser, id: number) {
  const current = await getVisibleTicket(user, id);
  if (!isRequesterOnly(user.role) || current.requesterId !== user.id) {
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
/** Anexos enviados ao abrir o chamado (salvos antes de o chamado ter id). */
const NEW_TICKET_FOLDER = "tickets/abertura";

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
  return tickets.oldestOpenTicketDate(canViewAllTickets(user.role) ? undefined : user.id);
}

/** Resumo para a página inicial: a equipe vê o geral e o que está com ela; admin, o geral; comum, os próprios. */
export async function getOverview(user: AuthUser) {
  // Admin vê o geral, mas não atende (não tem "com você agora").
  if (user.role === "admin") return { byStatus: await tickets.countByStatus({}) };
  if (isStaff(user.role)) {
    const [all, assignedToMe] = await Promise.all([
      tickets.countByStatus({}),
      tickets.countByStatus({ assigneeId: user.id }),
    ]);
    return { byStatus: all, assignedToMe };
  }
  return { byStatus: await tickets.countByStatus({ requesterId: user.id }) };
}
