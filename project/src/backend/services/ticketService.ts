import { categoryExists } from "../models/categoryModel.js";
import * as tickets from "../models/ticketModel.js";
import type { AuthUser, Ticket, TicketPriority } from "../models/types.js";
import { findUserById } from "../models/userModel.js";
import type { TicketQuery } from "../middlewares/schemas.js";
import type { UploadedFile } from "../middlewares/upload.js";
import { removeStored, resolveStored, saveFile } from "../utils/fileStorage.js";
import { MAX_COMMENTS_LENGTH } from "./ticketComments.js";
import { forbidden, HttpError, notFound } from "../utils/httpError.js";
import {
  applySupportRules,
  canComment,
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

export async function listTickets(user: AuthUser, query: TicketQuery) {
  const { page, pageSize, ...filters } = query;
  const scoped = isStaff(user.role) ? filters : { ...filters, requesterId: user.id };
  const { items, total } = await tickets.listTickets(scoped, page, pageSize);
  return { data: items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getTicketDetail(user: AuthUser, id: number) {
  const ticket = await getVisibleTicket(user, id);
  const [comments, history] = await Promise.all([tickets.listComments(id), tickets.listHistory(id)]);
  return {
    ...ticket,
    comments: comments.items,
    commentsUsed: comments.used,
    commentsMax: MAX_COMMENTS_LENGTH,
    history,
  };
}

export async function createTicket(
  user: AuthUser,
  data: { title: string; description: string; priority: TicketPriority; categoryId: number },
) {
  await assertCategory(data.categoryId);
  const id = await tickets.insertTicket({ ...data, requesterId: user.id });
  return getVisibleTicket(user, id);
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

  const changes = diffTicket(current, patch);
  if (changes.length === 0) return getTicketDetail(user, id);

  const statusChanged = changes.some((c) => c.field === "status");
  const timestamps = statusChanged && patch.status ? statusTimestamps(current, patch.status, new Date()) : {};
  await tickets.updateTicket(id, user.id, { ...patch, ...timestamps }, changes);
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
  const timestamps = statusTimestamps(current, patch.status, new Date());
  await tickets.updateTicket(id, user.id, { ...patch, ...timestamps }, diffTicket(current, patch));
  return getTicketDetail(user, id);
}

const attachmentFolder = (ticketId: number) => `tickets/${ticketId}`;

export async function addComment(user: AuthUser, id: number, body: string, files: UploadedFile[] = []) {
  const ticket = await getVisibleTicket(user, id);
  if (!canComment(user, ticket)) {
    throw forbidden("Somente quem abriu o chamado e o responsável por ele podem comentar");
  }
  if (user.role !== "admin" && ticket.status === "fechado") {
    throw new HttpError(409, "TICKET_CLOSED", "Este chamado está fechado e não aceita novos comentários");
  }
  const saved: tickets.NewAttachment[] = [];
  let fits = false;
  try {
    for (const file of files) {
      const filePath = await saveFile(attachmentFolder(id), file.extension, file.data);
      saved.push({ originalName: file.originalName, filePath, mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    }
    fits = await tickets.insertComment(id, user.id, body, saved);
  } finally {
    // Não deixa arquivos órfãos se a mensagem não foi gravada (erro ou falta de espaço).
    if (!fits) await Promise.all(saved.map((f) => removeStored(f.filePath).catch(() => undefined)));
  }
  if (!fits) {
    throw new HttpError(
      409,
      "COMMENTS_FULL",
      `Não há espaço para esta mensagem: os comentários do chamado são limitados a ${MAX_COMMENTS_LENGTH} caracteres. Escreva uma mensagem menor.`,
    );
  }
  return getTicketDetail(user, id);
}

/** Localiza o arquivo de um anexo, respeitando quem pode ver o chamado. */
export async function getAttachmentFile(user: AuthUser, attachmentId: number) {
  const attachment = await tickets.findAttachmentById(attachmentId);
  if (!attachment) throw notFound("Anexo não encontrado");
  await getVisibleTicket(user, attachment.ticketId);
  return { path: resolveStored(attachment.filePath), name: attachment.originalName };
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
