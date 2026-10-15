import * as reports from "../models/reportModel.js";
import type { ReportQuery } from "../middlewares/schemas.js";
import { toCsv } from "../utils/csv.js";
import { aggregateMachineReport } from "./machineReport.js";
import { HttpError } from "../utils/httpError.js";

/** Data local AAAA-MM-DD (o banco grava no fuso local). */
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Período padrão: últimos 30 dias até hoje. */
function resolvePeriod(query: ReportQuery): reports.Period {
  const to = query.to ?? day(new Date());
  const from = query.from ?? day(new Date(new Date(`${to}T12:00:00`).getTime() - 29 * 86_400_000));
  if (from > to) {
    throw new HttpError(400, "VALIDATION_ERROR", "A data inicial deve ser anterior à final", [
      { field: "from", message: "A data inicial deve ser anterior à final" },
    ]);
  }
  return { from, to };
}

export async function getSummary(query: ReportQuery) {
  const period = resolvePeriod(query);
  const [totals, byStatus, byPriority, byCategory, byAssignee, perDay] = await Promise.all([
    reports.resolutionStats(period),
    reports.ticketsByStatus(period),
    reports.ticketsByPriority(period),
    reports.ticketsByCategory(period),
    reports.ticketsByAssignee(period),
    reports.ticketsPerDay(period),
  ]);
  return { period, totals, byStatus, byPriority, byCategory, byAssignee, perDay };
}

/** Chamados abertos no período, por máquina vinculada, separados por status e categoria. */
export async function getMachineReport(query: ReportQuery) {
  const period = resolvePeriod(query);
  const [counts, withoutMachine] = await Promise.all([
    reports.ticketsByMachine(period),
    reports.ticketsWithoutMachine(period),
  ]);
  const { machines, categories } = aggregateMachineReport(counts);
  const withMachine = machines.reduce((sum, m) => sum + m.total, 0);
  return { period, totals: { withMachine, withoutMachine, machines: machines.length }, machines, categories };
}

const isoOrEmpty = (d: Date | null) => (d ? d.toISOString() : "");

export async function exportCsv(query: ReportQuery) {
  const period = resolvePeriod(query);
  const rows = await reports.ticketsForExport(period);
  const csv = toCsv(
    ["id", "titulo", "status", "prioridade", "categoria", "solicitante", "responsavel", "criado_em", "resolvido_em", "fechado_em"],
    rows.map((r) => [
      r.id,
      r.title,
      r.status,
      r.priority,
      r.category,
      r.requester,
      r.assignee,
      isoOrEmpty(r.created_at),
      isoOrEmpty(r.resolved_at),
      isoOrEmpty(r.closed_at),
    ]),
  );
  return { filename: `chamados_${period.from}_a_${period.to}.csv`, csv };
}
