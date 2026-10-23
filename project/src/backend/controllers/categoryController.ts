import type { Request, Response } from "express";
import * as categories from "../services/categoryService.js";

export async function list(_req: Request, res: Response) {
  res.json({ data: await categories.listCategories() });
}

export async function update(_req: Request, res: Response) {
  res.json({ data: await categories.setActive(res.locals.params.id, res.locals.body.active) });
}

export async function create(_req: Request, res: Response) {
  res.status(201).json({ data: await categories.createCategory(res.locals.body.name) });
}
