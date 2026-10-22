import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { useAsync } from "../hooks/useAsync";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { ApiError } from "../services/api";
import { notificationService } from "../services/deskhelp";
import type { Notification, NotificationType } from "../services/types";
import { formatDateTime, ticketNumber, timeAgo } from "../utils/format";

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<NotificationType, string> = { assigned: "Atribuição", comment: "Comentário", agenda: "Agenda" };

function describe(n: Notification) {
  if (n.type === "agenda") {
    const when = n.agendaScheduledAt ? ` (${formatDateTime(n.agendaScheduledAt)})` : "";
    return `Lembrete da agenda: “${n.agendaTitle ?? "item removido"}”${when}`;
  }
  const ticket = `#${ticketNumber(n.ticketId ?? 0)} “${n.ticketTitle ?? ""}”`;
  return n.type === "assigned" ? `atribuiu a você o chamado ${ticket}` : `comentou no chamado ${ticket}`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as "unread" | "read" | "";
  const type = (params.get("type") ?? "") as NotificationType | "";
  const page = Number(params.get("page") ?? 1);
  const [error, setError] = useState<ApiError | null>(null);

  const list = useAsync(
    () => notificationService.list({ status, type, page, pageSize: PAGE_SIZE }),
    [status, type, page],
  );
  // Novas notificações aparecem sem recarregar a página.
  useLiveRefresh(list.refresh);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      notifyNotificationsChanged();
      await list.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function open(n: Notification) {
    if (!n.read) {
      try {
        await notificationService.setRead(n.id, true);
        notifyNotificationsChanged();
      } catch {
        /* abrir o chamado é o que importa; a leitura fica para depois */
      }
    }
    navigate(n.type === "agenda" ? "/agenda" : `/chamados/${n.ticketId}`);
  }

  const hasFilters = Boolean(status || type);
  const unread = list.data?.unread ?? 0;
  const pagination = list.data?.pagination;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Notificações</h1>
          <p>
            Atribuições de chamados, comentários nos chamados que você abriu ou dos quais é responsável e
            lembretes da sua agenda.
            {unread > 0 && ` Você tem ${unread} não ${unread === 1 ? "lida" : "lidas"}.`}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => run(() => notificationService.readAll())}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="filters" role="search">
        <div className="field">
          <label htmlFor="n-status">Situação</label>
          <select id="n-status" className="select" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Todas</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="n-type">Tipo</label>
          <select id="n-type" className="select" value={type} onChange={(e) => update({ type: e.target.value })}>
            <option value="">Todos</option>
            <option value="assigned">Atribuição</option>
            <option value="comment">Comentário</option>
            <option value="agenda">Agenda</option>
          </select>
        </div>
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
            Limpar filtros
          </button>
        )}
      </div>

      <ErrorAlert error={error ?? list.error} onRetry={error ? undefined : list.reload} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data?.data.length ? (
        <>
          <ul className="notification-list">
            {list.data.data.map((n) => (
              <li key={n.id} className={n.read ? "notification" : "notification unread"}>
                <span className={n.read ? "tag tag-muted" : "tag"}>{TYPE_LABEL[n.type]}</span>
                <div className="notification-body">
                  <p>
                    {n.actorName && <strong>{n.actorName}</strong>} {describe(n)}
                  </p>
                  {n.commentExcerpt && <p className="notification-excerpt">{n.commentExcerpt}</p>}
                  <span className="notification-meta" title={formatDateTime(n.createdAt)}>
                    {timeAgo(n.createdAt)}
                    {n.read ? " · lida" : " · não lida"}
                  </span>
                </div>
                <div className="notification-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => open(n)}>
                    {n.type === "agenda" ? "Abrir agenda" : "Abrir chamado"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => run(() => notificationService.setRead(n.id, !n.read))}
                  >
                    {n.read ? "Marcar como não lida" : "Marcar como lida"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {pagination && pagination.totalPages > 1 && (
            <div className="pager">
              <span>
                {pagination.total} {pagination.total === 1 ? "notificação" : "notificações"}, página {pagination.page}{" "}
                de {pagination.totalPages}
              </span>
              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="panel">
          {hasFilters ? (
            <EmptyState title="Nenhuma notificação com esses filtros">
              <p>Remova algum filtro para ver as demais.</p>
            </EmptyState>
          ) : (
            <EmptyState
              title="Nenhuma notificação ainda"
              action={
                <Link className="btn btn-ghost" to="/chamados">
                  Ver chamados
                </Link>
              }
            >
              <p>Você será avisado quando receber um chamado ou um comentário nos seus chamados.</p>
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
