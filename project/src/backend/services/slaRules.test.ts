import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settingsRules.js";
import { hasAnySla, overdueRecipients, slaInfo, slaOnTimePercent } from "./slaRules.js";

const settings = { ...DEFAULT_SETTINGS, slaHoursCritica: 4, slaHoursAlta: 8 };
const opened = new Date("2026-01-10T08:00:00");
const at = (time: string) => new Date(`2026-01-10T${time}`);
const ticket = (over: Partial<Parameters<typeof slaInfo>[0]> = {}) => ({
  priority: "critica" as const,
  status: "aberto" as const,
  createdAt: opened,
  resolvedAt: null,
  closedAt: null,
  ...over,
});

describe("slaInfo", () => {
  it("prazo = abertura + horas da prioridade", () => {
    expect(slaInfo(ticket(), settings, at("09:00:00"))).toEqual({ dueAt: at("12:00:00"), state: "on_time" });
    expect(slaInfo(ticket({ priority: "alta" }), settings, at("09:00:00"))?.dueAt).toEqual(at("16:00:00"));
  });

  it("em aberto depois do prazo = atrasado", () => {
    expect(slaInfo(ticket({ status: "aguardando" }), settings, at("12:00:01"))?.state).toBe("overdue");
    expect(slaInfo(ticket(), settings, at("12:00:00"))?.state).toBe("on_time");
  });

  it("concluído: cumprido ou estourado pela data de resolução (ou de fechamento)", () => {
    const later = at("20:00:00");
    expect(slaInfo(ticket({ status: "resolvido", resolvedAt: at("11:59:00") }), settings, later)?.state).toBe("met");
    expect(slaInfo(ticket({ status: "resolvido", resolvedAt: at("12:30:00") }), settings, later)?.state).toBe("missed");
    expect(slaInfo(ticket({ status: "fechado", closedAt: at("10:00:00") }), settings, later)?.state).toBe("met");
  });

  it("sem prioridade ou sem prazo configurado: sem SLA", () => {
    expect(slaInfo(ticket({ priority: null }), settings, at("09:00:00"))).toBeNull();
    expect(slaInfo(ticket({ priority: "baixa" }), settings, at("09:00:00"))).toBeNull();
    expect(hasAnySla(DEFAULT_SETTINGS)).toBe(false);
    expect(hasAnySla(settings)).toBe(true);
  });
});

describe("overdueRecipients", () => {
  it("responsável; sem responsável, os super supports", () => {
    expect(overdueRecipients(7, [1, 2])).toEqual([7]);
    expect(overdueRecipients(null, [1, 2, 2])).toEqual([1, 2]);
  });
});

describe("prazos nas configurações", () => {
  it("lê horas positivas; o resto vira sem prazo", () => {
    const parsed = parseSettings({ sla_hours_critica: "4", sla_hours_alta: "0", sla_hours_media: "abc" });
    expect(parsed.slaHoursCritica).toBe(4);
    expect(parsed.slaHoursAlta).toBeNull();
    expect(parsed.slaHoursMedia).toBeNull();
    expect(parsed.slaHoursBaixa).toBeNull();
  });
});

describe("slaOnTimePercent", () => {
  it("cumpridos sobre todos com resultado, com uma casa decimal", () => {
    expect(slaOnTimePercent({ met: 2, missed: 1, overdue: 0 })).toBe(66.7);
    expect(slaOnTimePercent({ met: 3, missed: 0, overdue: 1 })).toBe(75);
    expect(slaOnTimePercent({ met: 0, missed: 0, overdue: 0 })).toBeNull();
  });
});
