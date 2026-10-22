import { useState } from "react";
import { Link } from "react-router";
import { useAsync } from "../hooks/useAsync";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { ApiError } from "../services/api";
import { agendaService } from "../services/deskhelp";
import type { AgendaItem } from "../services/types";
import { formatDateTime } from "../utils/format";
import { AgendaForm, agendaStatus } from "./AgendaForm";
import { notifyAgendaChanged } from "./AgendaReminder";
import { ErrorAlert, Loading } from "./Feedback";

/** Lembretes do usuário vinculados ao chamado, com a opção de criar e excluir. */
export function TicketAgendaPanel({ ticketId }: { ticketId: number }) {
  const items = useAsync(() => agendaService.list({ ticketId }), [ticketId]);
  useLiveRefresh(items.refresh);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onDelete(item: AgendaItem) {
    if (!window.confirm(`Excluir o lembrete “${item.title}”?`)) return;
    setError(null);
    try {
      await agendaService.remove(item.id);
      notifyAgendaChanged();
      notifyNotificationsChanged();
      void items.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <section className="panel" aria-labelledby="ticket-agenda-title">
      <div className="panel-head">
        <h2 id="ticket-agenda-title">Agenda</h2>
        <Link to="/agenda">Ver agenda</Link>
      </div>
      <ErrorAlert error={error} />
      <ErrorAlert error={items.error} onRetry={items.reload} />
      {items.loading && !items.data ? (
        <Loading />
      ) : items.data?.length ? (
        <ul className="ticket-agenda-list">
          {items.data.map((item) => {
            const s = agendaStatus(item);
            return (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span className="muted">{formatDateTime(item.scheduledAt)}</span>
                  <span className={s.className}>{s.label}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Excluir o lembrete ${item.title}`}
                  onClick={() => onDelete(item)}
                >
                  Excluir
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="muted">Nenhum lembrete seu para este chamado.</p>
      )}
      {adding ? (
        <AgendaForm
          ticketId={ticketId}
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            notifyAgendaChanged();
            void items.reload();
          }}
        />
      ) : (
        <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={() => setAdding(true)}>
          Adicionar à agenda
        </button>
      )}
    </section>
  );
}
