import { describe, expect, it } from "vitest";
import { aggregateMachineReport, type MachineTicketCount } from "./machineReport.js";

const base = { description: null, userName: null };
const counts: MachineTicketCount[] = [
  { ...base, machineId: 1, macAddress: "AA:00:00:00:00:01", status: "aberto", category: "Hardware", total: 2 },
  { ...base, machineId: 1, macAddress: "AA:00:00:00:00:01", status: "resolvido", category: "Hardware", total: 1 },
  { ...base, machineId: 1, macAddress: "AA:00:00:00:00:01", status: "resolvido", category: "Rede", total: 1 },
  { ...base, machineId: 2, macAddress: "AA:00:00:00:00:02", status: "aberto", category: "Rede", total: 5 },
];

describe("aggregateMachineReport", () => {
  const report = aggregateMachineReport(counts);

  it("adds up one row per machine, most tickets first", () => {
    expect(report.machines.map((m) => [m.machineId, m.total])).toEqual([
      [2, 5],
      [1, 4],
    ]);
  });

  it("splits each machine by status, filling missing statuses with zero", () => {
    expect(report.machines[1]!.byStatus).toEqual({
      aberto: 2,
      em_andamento: 0,
      aguardando: 0,
      resolvido: 2,
      fechado: 0,
    });
  });

  it("splits each machine by category, largest first", () => {
    expect(report.machines[1]!.byCategory).toEqual([
      { label: "Hardware", total: 3 },
      { label: "Rede", total: 1 },
    ]);
  });

  it("lists the categories present, most frequent first", () => {
    expect(report.categories).toEqual(["Rede", "Hardware"]);
  });

  it("breaks ties by MAC address", () => {
    const tied = aggregateMachineReport([
      { ...base, machineId: 9, macAddress: "BB:00:00:00:00:00", status: "aberto", category: "X", total: 1 },
      { ...base, machineId: 8, macAddress: "AA:00:00:00:00:00", status: "aberto", category: "X", total: 1 },
    ]);
    expect(tied.machines.map((m) => m.machineId)).toEqual([8, 9]);
  });

  it("returns empty lists when there are no tickets", () => {
    expect(aggregateMachineReport([])).toEqual({ machines: [], categories: [] });
  });
});
