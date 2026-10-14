import type { NextFunction, Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import { listCategories } from "../models/categoryModel.js";
import * as tickets from "../services/ticketService.js";
import { notFound } from "../utils/httpError.js";

export async function list(req: Request, res: Response) {
  res.json(await tickets.listTickets(currentUser(req), res.locals.query));
}

export async function overview(req: Request, res: Response) {
  res.json({ data: await tickets.getOverview(currentUser(req)) });
}

export async function get(req: Request, res: Response) {
  res.json({ data: await tickets.getTicketDetail(currentUser(req), res.locals.params.id) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await tickets.createTicket(currentUser(req), res.locals.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await tickets.updateTicket(currentUser(req), res.locals.params.id, res.locals.body) });
}

export async function remove(req: Request, res: Response) {
  await tickets.deleteTicket(currentUser(req), res.locals.params.id);
  res.status(204).end();
}

export async function addComment(req: Request, res: Response) {
  const comments = await tickets.addComment(
    currentUser(req),
    res.locals.params.id,
    res.locals.body.body,
    res.locals.files ?? [],
  );
  res.status(201).json({ data: comments });
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

export async function categories(_req: Request, res: Response) {
  res.json({ data: await listCategories() });
}
