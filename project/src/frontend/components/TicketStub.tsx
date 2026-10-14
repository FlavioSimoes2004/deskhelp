import type { CSSProperties, ReactNode } from "react";
import type { TicketStatus } from "../services/types";
import { ticketNumber } from "../utils/format";

interface Props {
  id: number;
  status: TicketStatus;
  children: ReactNode;
  label?: string;
}

/** Cabeçalho em forma de canhoto: o número do chamado destacado, na cor do status. */
export function TicketStub({ id, status, children, label = "Chamado" }: Props) {
  return (
    <div className="stub" style={{ "--stub-color": `var(--st-${status})` } as CSSProperties}>
      <div className="stub-number">
        <small>{label}</small>
        <strong>#{ticketNumber(id)}</strong>
      </div>
      <div className="stub-body">{children}</div>
    </div>
  );
}
