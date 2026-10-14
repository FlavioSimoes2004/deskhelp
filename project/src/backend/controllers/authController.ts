import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { currentUser } from "../middlewares/auth.js";
import * as auth from "../services/authService.js";

export async function login(_req: Request, res: Response) {
  const { email, password } = res.locals.body;
  res.json(await auth.login(email, password));
}

export async function register(_req: Request, res: Response) {
  res.status(201).json(await auth.register(res.locals.body));
}

export async function me(req: Request, res: Response) {
  res.json({ data: await auth.getProfile(currentUser(req).id) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ data: await auth.updateProfile(currentUser(req).id, res.locals.body) });
}

export function config(_req: Request, res: Response) {
  res.json({ allowSignup: env.ALLOW_SIGNUP });
}
