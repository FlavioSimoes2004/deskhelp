import type { Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import * as users from "../services/userService.js";

export async function list(_req: Request, res: Response) {
  res.json({ data: await users.listUsers(res.locals.query) });
}

export async function staff(_req: Request, res: Response) {
  res.json({ data: await users.listStaff() });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await users.createUser(currentUser(req), res.locals.body) });
}

export async function get(_req: Request, res: Response) {
  res.json({ data: await users.getUser(res.locals.params.id) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await users.updateUser(currentUser(req), res.locals.params.id, res.locals.body) });
}
