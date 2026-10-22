import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import type { Ticket } from "../services/types";
import { ticketNumber, timeAgo, formatDateTime } from "../utils/format";
import { PriorityOrNone, StatusBadge } from "./Badges";

/**
 * showPriority = false quando a configuração esconde a prioridade de quem está vendo.
 * Com a coluna visível, chamado sem prioridade aparece como "Sem prioridade".
 */
export function TicketTable({
  tickets,
  showRequester,
  showPriority = true,
}: {
  tickets: Ticket[];
  showRequester: boolean;
  showPriority?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Nº</th>
            <th scope="col">Assunto</th>
            <th scope="col">Status</th>
            {showPriority && <th scope="col">Prioridade</th>}
            {showRequester && <th scope="col">Solicitante</th>}
            <th scope="col">Responsável</th>
            <th scope="col">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr
              key={t.id}
              className="clickable"
              data-status={t.status}
              style={{ "--row-status": `var(--st-${t.status})` } as CSSProperties}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("a")) navigate(`/chamados/${t.id}`);
              }}
            >
              <td className="ticket-id">#{ticketNumber(t.id)}</td>
              <td>
                <Link className="ticket-title" to={`/chamados/${t.id}`}>
                  {t.title}
                </Link>
                <div className="muted">{t.categoryName}</div>
              </td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              {showPriority && (
                <td>
                  <PriorityOrNone priority={t.priority} />
                </td>
              )}
              {showRequester && <td>{t.requesterName}</td>}
              <td>{t.assigneeName ?? <span className="muted">Sem responsável</span>}</td>
              <td className="muted" title={formatDateTime(t.updatedAt)}>
                {timeAgo(t.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
