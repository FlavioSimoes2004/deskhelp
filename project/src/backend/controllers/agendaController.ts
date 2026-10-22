import type { Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import * as agenda from "../services/agendaService.js";

export async function list(req: Request, res: Response) {
  res.json({ data: await agenda.listItems(currentUser(req), res.locals.query) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await agenda.createItem(currentUser(req), res.locals.body) });
}

export async function due(req: Request, res: Response) {
  res.json({ data: await agenda.dueItems(currentUser(req)) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await agenda.updateItem(currentUser(req), res.locals.params.id, res.locals.body) });
}

export async function remove(req: Request, res: Response) {
  await agenda.deleteItem(currentUser(req), res.locals.params.id);
  res.status(204).end();
}

export async function dismiss(req: Request, res: Response) {
  await agenda.dismissItem(currentUser(req), res.locals.params.id);
  res.status(204).end();
}
