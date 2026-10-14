import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { TicketTable } from "../components/TicketTable";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ticketService, userService } from "../services/deskhelp";
import type { TicketPriority, TicketStatus } from "../services/types";
import { PRIORITY_LABEL, PRIORITY_ORDER, STATUS_LABEL, STATUS_ORDER } from "../utils/format";

const PAGE_SIZE = 20;

export function TicketsPage() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as TicketStatus | "";
  const priority = (params.get("priority") ?? "") as TicketPriority | "";
  const categoryId = params.get("categoryId") ?? "";
  const assigneeId = params.get("assigneeId") ?? "";
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? 1);

  // Busca com atraso para não consultar a cada tecla.
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  useEffect(() => {
    if (searchDraft === search) return;
    const timer = setTimeout(() => update({ search: searchDraft }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const categories = useAsync(() => ticketService.categories(), []);
  const admins = useAsync(() => (isAdmin ? userService.list({ role: "admin" }) : Promise.resolve([])), [isAdmin]);
  const list = useAsync(
    () =>
      ticketService.list({
        status,
        priority,
        categoryId: categoryId ? Number(categoryId) : "",
        assigneeId: assigneeId ? Number(assigneeId) : "",
        search,
        page,
        pageSize: PAGE_SIZE,
      }),
    [status, priority, categoryId, assigneeId, search, page],
  );

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  }

  const hasFilters = Boolean(status || priority || categoryId || assigneeId || search);
  const pagination = list.data?.pagination;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{isAdmin ? "Chamados" : "Meus chamados"}</h1>
          <p>
            {isAdmin ? "Todos os chamados abertos na empresa." : "Os chamados que você abriu e o andamento de cada um."}
          </p>
        </div>
        <Link className="btn btn-primary" to="/chamados/novo">
          Abrir chamado
        </Link>
      </div>

      <div className="filters" role="search">
        <div className="field grow">
          <label htmlFor="f-search">Buscar</label>
          <input
            id="f-search"
            className="input"
            type="search"
            placeholder="Assunto, descrição ou número"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" className="select" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Todos</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-priority">Prioridade</label>
          <select
            id="f-priority"
            className="select"
            value={priority}
            onChange={(e) => update({ priority: e.target.value })}
          >
            <option value="">Todas</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-category">Categoria</label>
          <select
            id="f-category"
            className="select"
            value={categoryId}
            onChange={(e) => update({ categoryId: e.target.value })}
          >
            <option value="">Todas</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div className="field">
            <label htmlFor="f-assignee">Responsável</label>
            <select
              id="f-assignee"
              className="select"
              value={assigneeId}
              onChange={(e) => update({ assigneeId: e.target.value })}
            >
              <option value="">Qualquer</option>
              {admins.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {hasFilters && (
          <button type="button" className="btn btn-ghost" onClick={() => setParams({}, { replace: true })}>
            Limpar filtros
          </button>
        )}
      </div>

      <ErrorAlert error={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data?.data.length ? (
        <>
          <TicketTable tickets={list.data.data} showRequester={isAdmin} />
          {pagination && (
            <div className="pager">
              <span>
                {pagination.total} {pagination.total === 1 ? "chamado" : "chamados"}, página {pagination.page} de{" "}
                {pagination.totalPages}
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
            <EmptyState title="Nenhum chamado com esses filtros">
              <p>Remova algum filtro ou busque por outro termo.</p>
            </EmptyState>
          ) : (
            <EmptyState
              title="Nenhum chamado por aqui"
              action={
                <Link className="btn btn-primary" to="/chamados/novo">
                  Abrir chamado
                </Link>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
