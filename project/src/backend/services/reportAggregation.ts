import { TICKET_STATUSES, type TicketStatus } from "../models/types.js";

/** Contagem de chamados de um grupo (máquina, pessoa...) por status e categoria. */
export interface GroupedCount {
  status: TicketStatus;
  category: string;
  total: number;
}

export interface Breakdown {
  total: number;
  /** Quantidade por status; todos os status aparecem, com 0 quando não houver chamados. */
  byStatus: Record<TicketStatus, number>;
  /** Quantidade por categoria (só as que têm chamados), da maior para a menor. */
  byCategory: { label: string; total: number }[];
}

const emptyStatus = () => Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
const byTotalThenLabel = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);

/**
 * Junta as contagens (grupo x status x categoria) em um item por grupo, mantendo a
 * primeira linha do grupo em "sample" (para nome, descrição etc.). A ordem dos grupos
 * fica a cargo de quem chama. Devolve também as categorias presentes, da mais para a
 * menos frequente.
 */
export function aggregateByGroup<T extends GroupedCount>(counts: T[], keyOf: (c: T) => string | number | null) {
  const groups = new Map<string | number | null, { sample: T; breakdown: Breakdown; categories: Map<string, number> }>();
  const categoryTotals = new Map<string, number>();

  for (const c of counts) {
    const key = keyOf(c);
    let group = groups.get(key);
    if (!group) {
      group = { sample: c, breakdown: { total: 0, byStatus: emptyStatus(), byCategory: [] }, categories: new Map() };
      groups.set(key, group);
    }
    group.breakdown.total += c.total;
    group.breakdown.byStatus[c.status] += c.total;
    group.categories.set(c.category, (group.categories.get(c.category) ?? 0) + c.total);
    categoryTotals.set(c.category, (categoryTotals.get(c.category) ?? 0) + c.total);
  }

  return {
    groups: [...groups.values()].map(({ sample, breakdown, categories }) => ({
      sample,
      breakdown: {
        ...breakdown,
        byCategory: [...categories].sort(byTotalThenLabel).map(([label, total]) => ({ label, total })),
      },
    })),
    categories: [...categoryTotals].sort(byTotalThenLabel).map(([label]) => label),
  };
}
