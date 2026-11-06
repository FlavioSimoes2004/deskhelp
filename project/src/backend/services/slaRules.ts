import type { TicketPriority, TicketStatus } from "../models/types.js";
import type { AppSettings } from "./settingsRules.js";

/**
 * Prazo (SLA) de atendimento por prioridade, contado da abertura do chamado.
 * - on_time: em aberto, dentro do prazo;
 * - overdue: em aberto, prazo estourado;
 * - met: resolvido/fechado dentro do prazo;
 * - missed: resolvido/fechado depois do prazo.
 * Sem prioridade ou sem prazo configurado para ela, o chamado não tem SLA (null).
 */
export type SlaState = "on_time" | "overdue" | "met" | "missed";

export interface SlaInfo {
  dueAt: Date;
  state: SlaState;
}

const HOURS_KEY: Record<TicketPriority, keyof AppSettings> = {
  critica: "slaHoursCritica",
  alta: "slaHoursAlta",
  media: "slaHoursMedia",
  baixa: "slaHoursBaixa",
};

/** Horas de prazo de cada prioridade (null = sem prazo). */
export function slaHoursByPriority(settings: AppSettings): Record<TicketPriority, number | null> {
  return {
    critica: settings[HOURS_KEY.critica] as number | null,
    alta: settings[HOURS_KEY.alta] as number | null,
    media: settings[HOURS_KEY.media] as number | null,
    baixa: settings[HOURS_KEY.baixa] as number | null,
  };
}

/** Algum prazo configurado. */
export const hasAnySla = (settings: AppSettings) => Object.values(slaHoursByPriority(settings)).some((h) => h !== null);

const isDone = (status: TicketStatus) => status === "resolvido" || status === "fechado";

export function slaInfo(
  ticket: {
    priority: TicketPriority | null;
    status: TicketStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    closedAt: Date | null;
  },
  settings: AppSettings,
  now: Date,
): SlaInfo | null {
  if (!ticket.priority) return null;
  const hours = slaHoursByPriority(settings)[ticket.priority];
  if (hours === null) return null;
  const dueAt = new Date(new Date(ticket.createdAt).getTime() + hours * 3_600_000);
  if (isDone(ticket.status)) {
    // Concluído: vale quando foi resolvido (ou fechado, se fechado sem passar por "resolvido").
    const doneAt = ticket.resolvedAt ?? ticket.closedAt ?? now;
    return { dueAt, state: new Date(doneAt) <= dueAt ? "met" : "missed" };
  }
  return { dueAt, state: now > dueAt ? "overdue" : "on_time" };
}

/** Quem é avisado do prazo estourado: o responsável ou, sem responsável, os super supports. */
export function overdueRecipients(assigneeId: number | null, superSupportIds: number[]): number[] {
  return assigneeId !== null ? [assigneeId] : [...new Set(superSupportIds)];
}

/** % dentro do prazo entre os chamados com resultado (cumpridos, estourados e atrasados); null sem nenhum. */
export function slaOnTimePercent(counts: { met: number; missed: number; overdue: number }): number | null {
  const total = counts.met + counts.missed + counts.overdue;
  return total === 0 ? null : Math.round((counts.met / total) * 1000) / 10;
}
