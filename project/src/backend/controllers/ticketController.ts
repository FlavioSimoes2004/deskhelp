import type { NextFunction, Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import { markTicketRead } from "../services/notificationService.js";
import * as tickets from "../services/ticketService.js";
import { notFound } from "../utils/httpError.js";

export async function list(req: Request, res: Response) {
  res.json(await tickets.listTickets(currentUser(req), res.locals.query));
}

export async function oldestOpen(req: Request, res: Response) {
  res.json({ data: { date: await tickets.getOldestOpenDate(currentUser(req)) } });
}

export async function overview(req: Request, res: Response) {
  res.json({ data: await tickets.getOverview(currentUser(req)) });
}

export async function get(req: Request, res: Response) {
  const user = currentUser(req);
  const detail = await tickets.getTicketDetail(user, res.locals.params.id);
  // Abrir o chamado conta como ler as notificações dele.
  await markTicketRead(user, detail.id);
  res.json({ data: detail });
}

export async function rate(req: Request, res: Response) {
  const { rating, comment } = res.locals.body;
  res.json({ data: await tickets.rateTicket(currentUser(req), res.locals.params.id, rating, comment) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await tickets.createTicket(currentUser(req), res.locals.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await tickets.updateTicket(currentUser(req), res.locals.params.id, res.locals.body) });
}

export async function addComment(req: Request, res: Response) {
  const ticket = await tickets.addComment(
    currentUser(req),
    res.locals.params.id,
    res.locals.body.body,
    res.locals.files ?? [],
    res.locals.body.internal,
  );
  res.status(201).json({ data: ticket });
}

export async function setSolution(req: Request, res: Response) {
  res.json({ data: await tickets.setSolution(currentUser(req), res.locals.params.id, res.locals.body.solution) });
}

export async function confirmSolution(req: Request, res: Response) {
  res.json({ data: await tickets.confirmSolution(currentUser(req), res.locals.params.id) });
}

export async function reopen(req: Request, res: Response) {
  res.json({ data: await tickets.reopenTicket(currentUser(req), res.locals.params.id) });
}

export async function resolve(req: Request, res: Response) {
  res.json({ data: await tickets.resolveOwnTicket(currentUser(req), res.locals.params.id) });
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  const file = await tickets.getAttachmentFile(currentUser(req), res.locals.params.id);
  res.download(file.path, file.name, (error) => {
    if (error && !res.headersSent) next(notFound("Arquivo do anexo não encontrado"));
  });
}
