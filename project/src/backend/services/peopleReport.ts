import type { TicketStatus } from "../models/types.js";
import { aggregateByGroup, type Breakdown } from "./reportAggregation.js";

export interface PersonTicketCount {
  userId: number | null;
  userName: string | null;
  status: TicketStatus;
  category: string;
  total: number;
}

export interface PersonResolution {
  userId: number | null;
  resolved: number;
  avgMinutes: number | null;
}

export interface PersonReportRow extends Breakdown {
  /** null = chamados sem responsável (só no relatório de responsáveis). */
  userId: number | null;
  userName: string | null;
  resolved: number;
  avgResolutionHours: number | null;
}

export const minutesToHours = (minutes: number | null) =>
  minutes === null ? null : Math.round((minutes / 60) * 10) / 10;

/**
 * Uma linha por pessoa, com status, categorias, resolvidos e tempo médio, da pessoa
 * com mais chamados para a com menos (empate: pelo nome; "sem responsável" por último).
 */
export function aggregatePeopleReport(counts: PersonTicketCount[], resolution: PersonResolution[]) {
  const { groups, categories } = aggregateByGroup(counts, (c) => c.userId);
  const resolutionOf = new Map(resolution.map((r) => [r.userId, r]));
  const people: PersonReportRow[] = groups
    .map(({ sample, breakdown }) => {
      const r = resolutionOf.get(sample.userId);
      return {
        userId: sample.userId,
        userName: sample.userName,
        ...breakdown,
        resolved: r?.resolved ?? 0,
        avgResolutionHours: minutesToHours(r?.avgMinutes ?? null),
      };
    })
    .sort(
      (a, b) =>
        Number(a.userId === null) - Number(b.userId === null) ||
        b.total - a.total ||
        (a.userName ?? "").localeCompare(b.userName ?? ""),
    );
  return { people, categories };
}
