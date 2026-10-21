import type { TicketStatus } from "../models/types.js";
import { aggregateByGroup, type Breakdown } from "./reportAggregation.js";

export interface MachineTicketCount {
  machineId: number;
  name: string | null;
  macAddress: string;
  description: string | null;
  userName: string | null;
  status: TicketStatus;
  category: string;
  total: number;
}

export interface MachineReportRow extends Breakdown {
  machineId: number;
  name: string | null;
  macAddress: string;
  description: string | null;
  userName: string | null;
}

/**
 * Junta as contagens (máquina x status x categoria) em uma linha por máquina,
 * ordenadas da máquina com mais chamados para a com menos (empate: pelo MAC).
 * Devolve também as categorias presentes, da mais para a menos frequente.
 */
export function aggregateMachineReport(counts: MachineTicketCount[]) {
  const { groups, categories } = aggregateByGroup(counts, (c) => c.machineId);
  const machines: MachineReportRow[] = groups
    .map(({ sample, breakdown }) => ({
      machineId: sample.machineId,
      name: sample.name,
      macAddress: sample.macAddress,
      description: sample.description,
      userName: sample.userName,
      ...breakdown,
    }))
    .sort((a, b) => b.total - a.total || a.macAddress.localeCompare(b.macAddress));
  return { machines, categories };
}
