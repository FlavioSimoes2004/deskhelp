import { deliverOverdueNotifications } from "../models/ticketModel.js";
import { getSettings } from "./settingsService.js";
import { hasAnySla, overdueRecipients, slaHoursByPriority } from "./slaRules.js";

const SCHEDULER_MS = 30_000;

/** Gera os avisos de prazo (SLA) estourado que ainda faltam. */
export async function deliverOverdue(): Promise<number> {
  const settings = await getSettings();
  if (!hasAnySla(settings)) return 0;
  return deliverOverdueNotifications(slaHoursByPriority(settings), overdueRecipients);
}

/**
 * Confere os prazos a cada 30 s e avisa (no sino) o responsável de cada chamado atrasado, ou
 * os super supports se ele não tiver responsável. O timer não segura o processo aberto (unref).
 */
export function startSlaScheduler() {
  const run = () =>
    deliverOverdue().catch((error) => console.error("Falha ao gerar avisos de prazo:", error));
  void run();
  setInterval(run, SCHEDULER_MS).unref();
}
