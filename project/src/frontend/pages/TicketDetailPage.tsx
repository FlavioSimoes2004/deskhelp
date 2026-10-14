import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { PriorityTag, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { TicketStub } from "../components/TicketStub";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { ticketService, userService } from "../services/deskhelp";
import type { Category, TicketDetail, TicketHistoryEntry, TicketPriority, TicketStatus, User } from "../services/types";
import {
  formatDateTime,
  initials,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
  timeAgo,
} from "../utils/format";

function describeChange(entry: TicketHistoryEntry, categories: Category[], users: User[]): string {
  const userName = (id: string | null) => (id ? (users.find((u) => String(u.id) === id)?.name ?? `#${id}`) : null);
  switch (entry.field) {
    case "status":
      return `mudou o status de ${STATUS_LABEL[entry.oldValue as TicketStatus]} para ${STATUS_LABEL[entry.newValue as TicketStatus]}`;
    case "priority":
      return `mudou a prioridade de ${PRIORITY_LABEL[entry.oldValue as TicketPriority]} para ${PRIORITY_LABEL[entry.newValue as TicketPriority]}`;
    case "assigneeId":
      return entry.newValue ? `atribuiu o chamado a ${userName(entry.newValue)}` : "removeu o responsável";
    case "categoryId": {
      const name = categories.find((c) => String(c.id) === entry.newValue)?.name ?? entry.newValue;
      return `mudou a categoria para ${name}`;
    }
    case "title":
      return `alterou o assunto para “${entry.newValue}”`;
    case "description":
      return "editou a descrição";
  }
}

export function TicketDetailPage() {
  const id = Number(useParams().id);
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const justCreated = Boolean((useLocation().state as { created?: boolean } | null)?.created);

  const ticket = useAsync(() => ticketService.get(id), [id]);
  const categories = useAsync(() => ticketService.categories(), []);
  const admins = useAsync(() => (isAdmin ? userService.list({ role: "admin" }) : Promise.resolve([])), [isAdmin]);

  if (ticket.loading && !ticket.data) return <Loading />;
  if (ticket.error?.status === 404 || Number.isNaN(id)) {
    return (
      <div className="page panel">
        <EmptyState
          title="Chamado não encontrado"
          action={
            <Link className="btn btn-ghost" to="/chamados">
              Voltar para os chamados
            </Link>
          }
        >
          <p>Ele pode ter sido excluído ou pertencer a outra pessoa.</p>
        </EmptyState>
      </div>
    );
  }
  if (!ticket.data) return <ErrorAlert error={ticket.error} onRetry={ticket.reload} />;

  const t = ticket.data;
  return (
    <div className="page">
      <p style={{ marginBottom: 12 }}>
        <Link to="/chamados">← Chamados</Link>
      </p>
      {justCreated && (
        <div className="alert alert-ok" role="status" style={{ marginBottom: 12 }}>
          Chamado aberto. Você vai ver aqui as respostas do suporte.
        </div>
      )}
      <TicketStub id={t.id} status={t.status}>
        <h1>{t.title}</h1>
        <div className="stub-meta">
          <StatusBadge status={t.status} />
          <PriorityTag priority={t.priority} />
          <span>{t.categoryName}</span>
          <span>
            Aberto por {t.requesterName} {timeAgo(t.createdAt)}
          </span>
        </div>
      </TicketStub>

      <div className="detail">
        <div>
          <section className="panel" aria-labelledby="desc-title">
            <div className="panel-head">
              <h2 id="desc-title">Descrição</h2>
            </div>
            <p className="description">{t.description}</p>
          </section>
          <Conversation
            ticket={t}
            canComment={isAdmin || t.status !== "fechado"}
            categories={categories.data ?? []}
            admins={admins.data ?? []}
            onCommented={(comments) => ticket.setData({ ...t, comments })}
          />
        </div>

        <aside>
          {isAdmin && user ? (
            <AdminPanel
              ticket={t}
              currentUserId={user.id}
              categories={categories.data ?? []}
              admins={(admins.data ?? []).filter((a) => a.active)}
              onSaved={(updated) => ticket.setData(updated)}
              onDeleted={() => navigate("/chamados", { replace: true })}
            />
          ) : null}
          <section className="panel" aria-labelledby="info-title">
            <div className="panel-head">
              <h2 id="info-title">Informações</h2>
            </div>
            <dl className="meta-list">
              <dt>Responsável</dt>
              <dd>{t.assigneeName ?? "Ainda não atribuído"}</dd>
              <dt>Aberto em</dt>
              <dd>{formatDateTime(t.createdAt)}</dd>
              <dt>Última atividade</dt>
              <dd>{formatDateTime(t.updatedAt)}</dd>
              {t.resolvedAt && (
                <>
                  <dt>Resolvido em</dt>
                  <dd>{formatDateTime(t.resolvedAt)}</dd>
                </>
              )}
              {t.closedAt && (
                <>
                  <dt>Fechado em</dt>
                  <dd>{formatDateTime(t.closedAt)}</dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Conversation({
  ticket,
  canComment,
  categories,
  admins,
  onCommented,
}: {
  ticket: TicketDetail;
  canComment: boolean;
  categories: Category[];
  admins: User[];
  onCommented: (comments: TicketDetail["comments"]) => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);

  const items = useMemo(() => {
    const comments = ticket.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, key: `c${c.id}`, c }));
    const events = ticket.history.map((h) => ({ kind: "event" as const, at: h.createdAt, key: `h${h.id}`, h }));
    return [...comments, ...events].sort((a, b) => a.at.localeCompare(b.at));
  }, [ticket.comments, ticket.history]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      onCommented(await ticketService.comment(ticket.id, body));
      setBody("");
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="conv-title">
      <div className="panel-head">
        <h2 id="conv-title">Conversa e histórico</h2>
      </div>
      {items.length === 0 ? (
        <p className="muted" style={{ color: "var(--ink-3)" }}>
          Nenhuma resposta ainda.
        </p>
      ) : (
        <ol className="timeline">
          {items.map((item) =>
            item.kind === "comment" ? (
              <li key={item.key}>
                <span className="avatar" aria-hidden="true">
                  {initials(item.c.userName)}
                </span>
                <div>
                  <strong>{item.c.userName}</strong>{" "}
                  <span className="muted" style={{ color: "var(--ink-3)", fontSize: "var(--step--1)" }} title={formatDateTime(item.at)}>
                    {timeAgo(item.at)}
                  </span>
                  <div className="comment-body">{item.c.body}</div>
                </div>
              </li>
            ) : (
              <li key={item.key}>
                <span className="event-dot" aria-hidden="true" />
                <span className="event" title={formatDateTime(item.at)}>
                  <strong>{item.h.userName}</strong> {describeChange(item.h, categories, admins)}, {timeAgo(item.at)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}

      {canComment ? (
        <form className="form" onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <ErrorAlert error={error} />
          <Field label="Responder">
            <textarea
              className="textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva uma atualização ou pergunta"
            />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={sending || !body.trim()}>
              {sending ? "Enviando…" : "Enviar resposta"}
            </button>
          </div>
        </form>
      ) : (
        <p className="alert alert-ok" style={{ marginTop: 20 }}>
          Este chamado foi fechado. Se o problema voltou, abra um novo chamado.
        </p>
      )}
    </section>
  );
}

function AdminPanel({
  ticket,
  currentUserId,
  categories,
  admins,
  onSaved,
  onDeleted,
}: {
  ticket: TicketDetail;
  currentUserId: number;
  categories: Category[];
  admins: User[];
  onSaved: (ticket: TicketDetail) => void;
  onDeleted: () => void;
}) {
  const initial = useMemo(
    () => ({
      status: ticket.status,
      priority: ticket.priority,
      categoryId: String(ticket.categoryId),
      assigneeId: ticket.assigneeId ? String(ticket.assigneeId) : "",
    }),
    [ticket],
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  async function save(patch: Parameters<typeof ticketService.update>[1]) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onSaved(await ticketService.update(ticket.id, patch));
      setSaved(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save({
      status: form.status,
      priority: form.priority,
      categoryId: Number(form.categoryId),
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
    });
  }

  async function onDelete() {
    if (!window.confirm(`Excluir o chamado #${ticket.id}? Comentários e histórico também serão apagados.`)) return;
    try {
      await ticketService.remove(ticket.id);
      onDeleted();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <section className="panel" aria-labelledby="manage-title">
      <div className="panel-head">
        <h2 id="manage-title">Atendimento</h2>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <ErrorAlert error={error} />
        {saved && !dirty && (
          <div className="alert alert-ok" role="status">
            Alterações salvas.
          </div>
        )}
        {ticket.assigneeId !== currentUserId && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() =>
              save({
                assigneeId: currentUserId,
                ...(ticket.status === "aberto" ? { status: "em_andamento" as const } : {}),
              })
            }
          >
            Assumir chamado
          </button>
        )}
        <Field label="Status">
          <select
            className="select"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as TicketStatus })}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Responsável">
          <select className="select" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Sem responsável</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.id === currentUserId ? " (você)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridade">
          <select
            className="select"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}
          >
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-primary" type="submit" disabled={!dirty || saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Excluir chamado
        </button>
      </form>
    </section>
  );
}
