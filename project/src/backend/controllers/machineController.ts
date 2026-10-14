import type { Request, Response } from "express";
import * as machines from "../services/machineService.js";

export async function list(_req: Request, res: Response) {
  res.json({ data: await machines.listMachines(res.locals.query) });
}

export async function get(_req: Request, res: Response) {
  res.json({ data: await machines.getMachine(res.locals.params.id) });
}

export async function create(_req: Request, res: Response) {
  res.status(201).json({ data: await machines.createMachine(res.locals.body) });
}

export async function update(_req: Request, res: Response) {
  res.json({ data: await machines.updateMachine(res.locals.params.id, res.locals.body) });
}
