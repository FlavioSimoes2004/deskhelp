import { categoryExists } from "../models/categoryModel.js";
import * as tickets from "../models/ticketModel.js";
import type { AuthUser, Ticket, TicketPriority } from "../models/types.js";
import { findUserById } from "../models/userModel.js";
import type { TicketQuery } from "../middlewares/schemas.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { canViewTicket, diffTicket, statusTimestamps, type TicketEditableFields } from "./ticketRules.js";

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
  const scoped = user.role === "admin" ? filters : { ...filters, requesterId: user.id };
  const { items, total } = await tickets.listTickets(scoped, page, pageSize);
  return { data: items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getTicketDetail(user: AuthUser, id: number) {
  const ticket = await getVisibleTicket(user, id);
  const [comments, history] = await Promise.all([tickets.listComments(id), tickets.listHistory(id)]);
  return { ...ticket, comments, history };
}

export async function createTicket(
  user: AuthUser,
  data: { title: string; description: string; priority: TicketPriority; categoryId: number },
) {
  await assertCategory(data.categoryId);
  const id = await tickets.insertTicket({ ...data, requesterId: user.id });
  return getVisibleTicket(user, id);
}

export async function updateTicket(user: AuthUser, id: number, patch: Partial<TicketEditableFields>) {
  const current = await getVisibleTicket(user, id);
  if (patch.categoryId !== undefined) await assertCategory(patch.categoryId);
  if (patch.assigneeId != null) {
    const assignee = await findUserById(patch.assigneeId);
    if (!assignee || assignee.role !== "admin" || !assignee.active) {
      throw new HttpError(400, "VALIDATION_ERROR", "O responsável precisa ser um administrador ativo", [
        { field: "assigneeId", message: "O responsável precisa ser um administrador ativo" },
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

export async function deleteTicket(user: AuthUser, id: number) {
  await getVisibleTicket(user, id);
  await tickets.deleteTicket(id);
}

export async function addComment(user: AuthUser, id: number, body: string) {
  const ticket = await getVisibleTicket(user, id);
  if (user.role !== "admin" && ticket.status === "fechado") {
    throw new HttpError(409, "TICKET_CLOSED", "Este chamado está fechado e não aceita novos comentários");
  }
  await tickets.insertComment(id, user.id, body);
  return tickets.listComments(id);
}

/** Resumo para a página inicial: admin vê o geral e o que está com ele; comum vê os próprios. */
export async function getOverview(user: AuthUser) {
  if (user.role === "admin") {
    const [all, assignedToMe] = await Promise.all([
      tickets.countByStatus({}),
      tickets.countByStatus({ assigneeId: user.id }),
    ]);
    return { byStatus: all, assignedToMe };
  }
  return { byStatus: await tickets.countByStatus({ requesterId: user.id }) };
}
