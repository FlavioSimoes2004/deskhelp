import * as agenda from "../models/agendaModel.js";
import { findTicketById } from "../models/ticketModel.js";
import type { AuthUser } from "../models/types.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { isNotInPast, parseLocalDateTime } from "./agendaRules.js";
import { canViewTicket } from "./ticketRules.js";

export async function createItem(
  user: AuthUser,
  data: { title: string; description: string | null; scheduledAt: string; ticketId: number | null },
) {
  const scheduledAt = parseLocalDateTime(data.scheduledAt);
  if (!scheduledAt || !isNotInPast(scheduledAt, new Date())) {
    const message = scheduledAt ? "Escolha uma data e hora a partir de agora" : "Data ou hora inválida";
    throw new HttpError(400, "VALIDATION_ERROR", message, [{ field: "scheduledAt", message }]);
  }
  if (data.ticketId !== null) {
    // Só vincula chamados que o usuário pode ver (mesma regra da página do chamado).
    const ticket = await findTicketById(data.ticketId);
    if (!ticket || !canViewTicket(user, ticket)) throw notFound("Chamado não encontrado");
  }
  const id = await agenda.insertAgendaItem(user.id, { ...data, scheduledAt });
  return agenda.findAgendaItem(user.id, id);
}

export const listItems = (user: AuthUser, filters: { when?: "upcoming" | "past"; ticketId?: number }) =>
  agenda.listAgendaItems(user.id, filters);

export async function deleteItem(user: AuthUser, id: number) {
  if (!(await agenda.deleteAgendaItem(user.id, id))) throw notFound("Item da agenda não encontrado");
}

/** Avisos a mostrar na tela; antes gera as notificações que ainda faltam deste usuário. */
export async function dueItems(user: AuthUser) {
  await agenda.deliverDueAgendaItems(user.id);
  return agenda.listDueAgendaItems(user.id);
}

export async function dismissItem(user: AuthUser, id: number) {
  if (!(await agenda.dismissAgendaItem(user.id, id))) throw notFound("Item da agenda não encontrado");
}

const SCHEDULER_MS = 30_000;

/**
 * Gera as notificações da agenda a cada 30 s, mesmo para quem não está com a tela
 * aberta. O timer não segura o processo aberto (unref).
 */
export function startAgendaScheduler() {
  const run = () =>
    agenda.deliverDueAgendaItems().catch((error) => console.error("Falha ao gerar avisos da agenda:", error));
  void run();
  setInterval(run, SCHEDULER_MS).unref();
}
