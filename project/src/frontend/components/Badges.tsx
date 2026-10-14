import type { CSSProperties } from "react";
import type { TicketPriority, TicketStatus } from "../services/types";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL } from "../utils/format";

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
