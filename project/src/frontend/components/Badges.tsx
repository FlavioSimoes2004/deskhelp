import type { CSSProperties } from "react";
import type { SlaState, TicketPriority, TicketStatus } from "../services/types";
import { formatDateTime, PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL } from "../utils/format";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className="status" style={{ "--dot": `var(--st-${status})` } as CSSProperties}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Prioridade como 1–3 barras (crítica acende as 3 em vermelho) + rótulo. */
export function PriorityTag({ priority }: { priority: TicketPriority }) {
  const level = Math.max(1, PRIORITY_ORDER.indexOf(priority));
  return (
    <span className="priority" style={{ "--pri": `var(--pr-${priority})` } as CSSProperties}>
      <span className="bars" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= level ? "on" : undefined} />
        ))}
      </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/** Prioridade do chamado ou "Sem prioridade" quando ainda não foi definida. */
export function PriorityOrNone({ priority }: { priority: TicketPriority | null }) {
  return priority ? <PriorityTag priority={priority} /> : <span className="muted">Sem prioridade</span>;
}

const SLA_LABEL: Record<SlaState, string> = {
  on_time: "No prazo",
  overdue: "Atrasado",
  met: "Cumprido no prazo",
  missed: "Fora do prazo",
};

const SLA_CLASS: Record<SlaState, string> = {
  on_time: "tag tag-muted",
  overdue: "tag tag-danger",
  met: "tag tag-ok",
  missed: "tag tag-alert",
};

/** Situação do prazo (SLA) do chamado; o título mostra a data limite. */
export function SlaBadge({ state, dueAt }: { state: SlaState; dueAt: string | null }) {
  return (
    <span className={SLA_CLASS[state]} title={dueAt ? `Prazo: ${formatDateTime(dueAt)}` : undefined}>
      {SLA_LABEL[state]}
    </span>
  );
}
