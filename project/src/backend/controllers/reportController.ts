import type { Request, Response } from "express";
import * as reports from "../services/reportService.js";

export async function summary(_req: Request, res: Response) {
  res.json({ data: await reports.getSummary(res.locals.query) });
}

export async function machines(_req: Request, res: Response) {
  res.json({ data: await reports.getMachineReport(res.locals.query) });
}

export async function exportCsv(_req: Request, res: Response) {
  const { filename, csv } = await reports.exportCsv(res.locals.query);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // BOM para o Excel reconhecer UTF-8 (acentos).
  res.send(`﻿${csv}`);
}
