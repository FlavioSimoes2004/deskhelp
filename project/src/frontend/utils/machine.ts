import type { StorageType } from "../services/types";

export const STORAGE_LABEL: Record<StorageType, string> = { ssd: "SSD", hd: "HD" };

/** "RECEPCAO-01 (AA:BB:…)"; sem nome, "AA:BB:… (descrição)"; sem nenhum, só o MAC. */
export function machineLabel(m: { name: string | null; macAddress: string; description: string | null }) {
  if (m.name) return `${m.name} (${m.macAddress})`;
  return m.description ? `${m.macAddress} (${m.description})` : m.macAddress;
}

/** GB em texto curto: 512 GB, 1 TB, 1,5 TB. */
export function formatGb(gb: number) {
  if (gb < 1024) return `${gb} GB`;
  return `${(Math.round((gb / 1024) * 10) / 10).toLocaleString("pt-BR")} TB`;
}

/** Resumo da configuração: "16 GB DDR4 · Core i5-10400 · 512 GB SSD · GTX 1650"; null se nada preenchido. */
export function machineSpecs(m: {
  ramGb: number | null;
  ramType: string | null;
  cpu: string | null;
  storageGb: number | null;
  storageType: StorageType | null;
  gpu: string | null;
}): string | null {
  const ram = [m.ramGb ? formatGb(m.ramGb) : null, m.ramType].filter(Boolean).join(" ");
  const storage = [m.storageGb ? formatGb(m.storageGb) : null, m.storageType ? STORAGE_LABEL[m.storageType] : null]
    .filter(Boolean)
    .join(" ");
  const parts = [ram, m.cpu, storage, m.gpu].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
