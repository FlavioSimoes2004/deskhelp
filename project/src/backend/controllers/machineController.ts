import type { Request, Response } from "express";
import { currentUser } from "../middlewares/auth.js";
import * as machines from "../services/machineService.js";

export async function list(_req: Request, res: Response) {
  res.json({ data: await machines.listMachines(res.locals.query) });
}

export async function get(_req: Request, res: Response) {
  res.json({ data: await machines.getMachine(res.locals.params.id) });
}

export async function create(req: Request, res: Response) {
  res.status(201).json({ data: await machines.createMachine(currentUser(req).id, res.locals.body) });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await machines.updateMachine(currentUser(req).id, res.locals.params.id, res.locals.body) });
}

export async function history(_req: Request, res: Response) {
  res.json({ data: await machines.getMachineHistory(res.locals.params.id) });
}
