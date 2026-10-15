import type { Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import * as notifications from "../services/notificationService.js";

export async function list(req: Request, res: Response) {
  res.json(await notifications.listNotifications(currentUser(req), res.locals.query));
}

export async function unreadCount(req: Request, res: Response) {
  res.json({ data: { unread: await notifications.countUnread(currentUser(req)) } });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await notifications.setRead(currentUser(req), res.locals.params.id, res.locals.body.read) });
}

export async function readAll(req: Request, res: Response) {
  res.json({ data: await notifications.markAllRead(currentUser(req)) });
}
