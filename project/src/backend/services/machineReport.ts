import { TICKET_STATUSES, type TicketStatus } from "../models/types.js";

export interface MachineTicketCount {
  machineId: number;
  macAddress: string;
  description: string | null;
  userName: string | null;
  status: TicketStatus;
  category: string;
  total: number;
}

export interface MachineReportRow {
  machineId: number;
  macAddress: string;
  description: string | null;
  userName: string | null;
  total: number;
  /** Quantidade por status; todos os status aparecem, com 0 quando não houver chamados. */
  byStatus: Record<TicketStatus, number>;
  /** Quantidade por categoria (só as que têm chamados), da maior para a menor. */
  byCategory: { label: string; total: number }[];
}

const emptyStatus = () => Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;

/**
 * Junta as contagens (máquina x status x categoria) em uma linha por máquina,
 * ordenadas da máquina com mais chamados para a com menos (empate: pelo MAC).
 * Devolve também as categorias presentes, da mais para a menos frequente.
 */
export function aggregateMachineReport(counts: MachineTicketCount[]) {
  const machines = new Map<number, MachineReportRow & { categoryMap: Map<string, number> }>();
  const categoryTotals = new Map<string, number>();

  for (const c of counts) {
    let row = machines.get(c.machineId);
    if (!row) {
      row = {
        machineId: c.machineId,
        macAddress: c.macAddress,
        description: c.description,
        userName: c.userName,
        total: 0,
        byStatus: emptyStatus(),
        byCategory: [],
        categoryMap: new Map(),
      };
      machines.set(c.machineId, row);
    }
    row.total += c.total;
    row.byStatus[c.status] += c.total;
    row.categoryMap.set(c.category, (row.categoryMap.get(c.category) ?? 0) + c.total);
    categoryTotals.set(c.category, (categoryTotals.get(c.category) ?? 0) + c.total);
  }

  const byTotalThenLabel = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const rows: MachineReportRow[] = [...machines.values()]
    .map(({ categoryMap, ...row }) => ({
      ...row,
      byCategory: [...categoryMap].sort(byTotalThenLabel).map(([label, total]) => ({ label, total })),
    }))
    .sort((a, b) => b.total - a.total || a.macAddress.localeCompare(b.macAddress));
  const categories = [...categoryTotals].sort(byTotalThenLabel).map(([label]) => label);
  return { machines: rows, categories };
}
