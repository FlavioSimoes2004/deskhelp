import type { Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import * as settings from "../services/settingsService.js";

export async function get(_req: Request, res: Response) {
  res.json({ data: await settings.getSettings() });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await settings.updateSettings(currentUser(req), res.locals.body) });
}
