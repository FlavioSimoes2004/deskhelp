import { useState } from "react";
import { Link } from "react-router";
import { AgendaForm, agendaStatus, isAgendaEditable } from "../components/AgendaForm";
import { notifyAgendaChanged } from "../components/AgendaReminder";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { ApiError } from "../services/api";
import { agendaService } from "../services/deskhelp";
import type { AgendaItem } from "../services/types";
import { formatDateTime, ticketNumber } from "../utils/format";

type When = "upcoming" | "past" | "";


export function AgendaPage() {
  const [when, setWhen] = useState<When>("upcoming");
  const items = useAsync(() => agendaService.list({ when }), [when]);
  // A situação dos lembretes muda quando a hora chega.
  useLiveRefresh(items.refresh);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<AgendaItem | null>(null);

  async function onDelete(item: AgendaItem) {
    if (!window.confirm(`Excluir o lembrete “${item.title}”?`)) return;
    setError(null);
    try {
      await agendaService.remove(item.id);
      if (editing?.id === item.id) setEditing(null);
      setNotice(`Lembrete “${item.title}” excluído.`);
      notifyAgendaChanged();
      notifyNotificationsChanged();
      void items.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p>Crie lembretes com data e hora. Na hora marcada, um aviso aparece na tela e nas suas notificações.</p>
        </div>
      </div>

      {/* Editando: o formulário mostra o lembrete escolhido; senão, cria um novo. */}
      {editing ? (
        <AgendaForm
          key={editing.id}
          item={editing}
          onCancel={() => setEditing(null)}
          onCreated={(item) => {
            setEditing(null);
            setNotice(`Lembrete “${item.title}” atualizado para ${formatDateTime(item.scheduledAt)}.`);
            notifyAgendaChanged();
            void items.reload();
          }}
        />
      ) : (
        <AgendaForm
          onCreated={(item) => {
            setNotice(`Lembrete “${item.title}” agendado para ${formatDateTime(item.scheduledAt)}.`);
            notifyAgendaChanged();
            void items.reload();
          }}
        />
      )}

      {notice && (
        <div className="alert alert-ok" role="status" style={{ margin: "16px 0" }}>
          {notice}
        </div>
      )}

      <div className="filters" role="search" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="a-when">Mostrar</label>
          <select id="a-when" className="select" value={when} onChange={(e) => setWhen(e.target.value as When)}>
            <option value="upcoming">Próximos</option>
            <option value="past">Passados</option>
            <option value="">Todos</option>
          </select>
        </div>
      </div>

      <ErrorAlert error={error} />
      <ErrorAlert error={items.error} onRetry={items.reload} />
      {items.loading && !items.data ? (
        <Loading />
      ) : items.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Data e hora</th>
                <th scope="col">Título</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((item) => {
                const s = agendaStatus(item);
                const canDismiss = !item.dismissedAt && new Date(item.scheduledAt).getTime() <= Date.now();
                return (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(item.scheduledAt)}</td>
                    <td>
                      <strong>{item.title}</strong>
                      {item.description && (
                        <span className="muted" style={{ display: "block", whiteSpace: "pre-wrap" }}>
                          {item.description}
                        </span>
                      )}
                      {item.ticketId && (
                        <Link to={`/chamados/${item.ticketId}`} style={{ display: "block", fontSize: "var(--step--1)" }}>
                          Chamado #{ticketNumber(item.ticketId)} {item.ticketTitle ? `“${item.ticketTitle}”` : ""}
                        </Link>
                      )}
                    </td>
                    <td>
                      <span className={s.className}>{s.label}</span>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {canDismiss && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            await agendaService.dismiss(item.id).catch(() => undefined);
                            notifyAgendaChanged();
                            notifyNotificationsChanged();
                            void items.reload();
                          }}
                        >
                          Dispensar
                        </button>
                      )}{" "}
                      {isAgendaEditable(item) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setNotice(null);
                            setEditing(item);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Editar
                        </button>
                      )}{" "}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState title={when === "past" ? "Nenhum lembrete passado" : "Nenhum lembrete agendado"}>
            <p>Use o formulário acima para criar um lembrete.</p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
