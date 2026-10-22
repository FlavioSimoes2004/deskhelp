import type { Request, Response } from "express";
import * as reports from "../services/reportService.js";

export async function summary(_req: Request, res: Response) {
  res.json({ data: await reports.getSummary(res.locals.query) });
}

export async function machines(_req: Request, res: Response) {
  res.json({ data: await reports.getMachineReport(res.locals.query) });
}

export async function requesters(_req: Request, res: Response) {
  res.json({ data: await reports.getPeopleReport(res.locals.query, "requester") });
}

export async function assignees(_req: Request, res: Response) {
  res.json({ data: await reports.getPeopleReport(res.locals.query, "assignee") });
}

function sendCsv(res: Response, { filename, csv }: { filename: string; csv: string }) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // BOM para o Excel reconhecer UTF-8 (acentos).
  res.send(`\uFEFF${csv}`);
}

export async function exportCsv(_req: Request, res: Response) {
  sendCsv(res, await reports.exportCsv(res.locals.query));
}

export async function machinesCsv(_req: Request, res: Response) {
  sendCsv(res, await reports.exportMachineCsv(res.locals.query));
}

export async function requestersCsv(_req: Request, res: Response) {
  sendCsv(res, await reports.exportPeopleCsv(res.locals.query, "requester"));
}

export async function assigneesCsv(_req: Request, res: Response) {
  sendCsv(res, await reports.exportPeopleCsv(res.locals.query, "assignee"));
}
