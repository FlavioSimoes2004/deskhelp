import * as reports from "../models/reportModel.js";
import type { ReportQuery } from "../middlewares/schemas.js";
import { toCsv } from "../utils/csv.js";
import { aggregateMachineReport } from "./machineReport.js";
import { aggregatePeopleReport } from "./peopleReport.js";
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

/**
 * Chamados abertos no período por quem abriu (requester) ou por responsável (assignee),
 * separados por status e categoria, com resolvidos e tempo médio até resolver.
 */
export async function getPeopleReport(query: ReportQuery, role: reports.PersonRole) {
  const period = resolvePeriod(query);
  const [counts, resolution, totals] = await Promise.all([
    reports.ticketsByPerson(period, role),
    reports.resolutionByPerson(period, role),
    reports.resolutionStats(period),
  ]);
  const { people, categories } = aggregatePeopleReport(counts, resolution);
  const unassigned = people.find((p) => p.userId === null)?.total ?? 0;
  return {
    period,
    totals: { ...totals, people: people.filter((p) => p.userId !== null).length, unassigned },
    people,
    categories,
  };
}

// Cabeçalhos das colunas de status no CSV (mesma ordem do relatório).
const STATUS_COLUMNS = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"] as const;

/** CSV do relatório de máquinas: uma linha por máquina, com status e categorias. */
export async function exportMachineCsv(query: ReportQuery) {
  const { period, machines, categories } = await getMachineReport(query);
  const csv = toCsv(
    ["maquina", "mac", "descricao", "usuario", "total", ...STATUS_COLUMNS, ...categories],
    machines.map((m) => [
      m.name,
      m.macAddress,
      m.description,
      m.userName,
      m.total,
      ...STATUS_COLUMNS.map((s) => m.byStatus[s]),
      ...categories.map((c) => m.byCategory.find((x) => x.label === c)?.total ?? 0),
    ]),
  );
  return { filename: `maquinas_${period.from}_a_${period.to}.csv`, csv };
}

/** CSV do relatório de solicitantes ou de responsáveis. */
export async function exportPeopleCsv(query: ReportQuery, role: reports.PersonRole) {
  const { period, people, categories } = await getPeopleReport(query, role);
  const who = role === "requester" ? "solicitante" : "responsavel";
  const csv = toCsv(
    [
      who,
      "chamados",
      "resolvidos",
      "taxa_resolucao_pct",
      "tempo_medio_resolucao_h",
      "avaliacao_media",
      "avaliacoes",
      ...STATUS_COLUMNS,
      ...categories,
    ],
    people.map((p) => [
      p.userName ?? "Sem responsável",
      p.total,
      p.resolved,
      Math.round((p.resolved / p.total) * 100),
      p.avgResolutionHours,
      p.avgRating,
      p.rated,
      ...STATUS_COLUMNS.map((s) => p.byStatus[s]),
      ...categories.map((c) => p.byCategory.find((x) => x.label === c)?.total ?? 0),
    ]),
  );
  return { filename: `${role === "requester" ? "solicitantes" : "responsaveis"}_${period.from}_a_${period.to}.csv`, csv };
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
