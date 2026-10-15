import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import { PriorityTag, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { TicketStub } from "../components/TicketStub";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { ticketService, userService } from "../services/deskhelp";
import type {
  Category,
  TicketAttachment,
  TicketDetail,
  TicketHistoryEntry,
  TicketPriority,
  TicketStatus,
  User,
} from "../services/types";
import {
  formatBytes,
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
  const { user, isAdmin, isStaff } = useAuth();
  const justCreated = Boolean((useLocation().state as { created?: boolean } | null)?.created);

  const ticket = useAsync(() => ticketService.get(id), [id]);
  const categories = useAsync(() => ticketService.categories(), []);
  const staff = useAsync(() => (isStaff ? userService.staff() : Promise.resolve([])), [isStaff]);

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
  const isParticipant = user !== null && (t.requesterId === user.id || t.assigneeId === user.id);
  const commentBlocked = !isParticipant
    ? isStaff && t.assigneeId === null
      ? "Assuma o chamado para poder responder."
      : "Somente quem abriu o chamado e o responsável por ele podem responder."
    : !isAdmin && t.status === "fechado"
      ? "Este chamado foi fechado. Se o problema voltou, abra um novo chamado."
      : null;
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
            blockedReason={commentBlocked}
            categories={categories.data ?? []}
            staff={staff.data ?? []}
            onCommented={(updated) => ticket.setData(updated)}
          />
        </div>

        <aside>
          {isStaff && user ? (
            <ManagePanel
              ticket={t}
              isAdmin={isAdmin}
              currentUserId={user.id}
              categories={categories.data ?? []}
              staff={(staff.data ?? []).filter((a) => a.active)}
              onSaved={(updated) => ticket.setData(updated)}
            />
          ) : null}
          {user?.role === "comum" && t.requesterId === user.id && t.status !== "resolvido" && t.status !== "fechado" && (
            <ResolvePanel ticketId={t.id} onResolved={(updated) => ticket.setData(updated)} />
          )}
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

const COMMENT_PREFIX_ESTIMATE = 45;

function Conversation({
  ticket,
  blockedReason,
  categories,
  staff,
  onCommented,
}: {
  ticket: TicketDetail;
  /** Motivo pelo qual o usuário não pode responder; null quando pode. */
  blockedReason: string | null;
  categories: Category[];
  staff: User[];
  onCommented: (ticket: TicketDetail) => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);

  const items = useMemo(() => {
    const comments = ticket.comments.map((c) => ({ kind: "comment" as const, at: c.createdAt, key: `c${c.id}`, c }));
    const events = ticket.history.map((h) => ({ kind: "event" as const, at: h.createdAt, key: `h${h.id}`, h }));
    return [...comments, ...events].sort((a, b) => a.at.localeCompare(b.at));
  }, [ticket.comments, ticket.history]);

  // Todas as mensagens dividem a coluna de comentários do chamado; cada uma gasta
  // ~45 caracteres com o prefixo (data, usuário) e alguns a mais por anexo.
  // É uma estimativa: quem confere de fato é a API.
  const free = ticket.commentsMax - ticket.commentsUsed - (ticket.commentsUsed > 0 ? 1 : 0);
  const room = free - COMMENT_PREFIX_ESTIMATE - files.length * 6;
  const full = free <= COMMENT_PREFIX_ESTIMATE;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      onCommented(await ticketService.comment(ticket.id, body, files));
      setBody("");
      setFiles([]);
      setFileInputKey((k) => k + 1);
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
                  {item.c.attachments.length > 0 && (
                    <ul className="attachments">
                      {item.c.attachments.map((a) => (
                        <li key={a.id}>
                          <AttachmentLink attachment={a} onError={setError} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ) : (
              <li key={item.key}>
                <span className="event-dot" aria-hidden="true" />
                <span className="event" title={formatDateTime(item.at)}>
                  <strong>{item.h.userName}</strong> {describeChange(item.h, categories, staff)}, {timeAgo(item.at)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}

      {blockedReason === null && full ? (
        <p className="alert alert-ok" style={{ marginTop: 20 }}>
          Os comentários deste chamado atingiram o limite de {ticket.commentsMax} caracteres.
        </p>
      ) : blockedReason === null ? (
        <form className="form" onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <ErrorAlert error={error} />
          <Field
            label="Responder"
            hint={`Restam cerca de ${Math.max(0, room - body.trim().length)} caracteres para mensagens neste chamado (limite total de ${ticket.commentsMax}). Quebras de linha viram espaço.`}
          >
            <textarea
              className="textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva uma atualização ou pergunta"
            />
          </Field>
          <Field label="Anexos" hint="Até 5 arquivos de 10 MB: imagens, PDF, texto, planilhas, documentos ou ZIP.">
            <input
              key={fileInputKey}
              className="input"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods,.zip"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
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
          {blockedReason}
        </p>
      )}
    </section>
  );
}

/**
 * Atendimento do chamado. Admin altera tudo; suporte só assume chamados sem
 * responsável e altera prioridade e categoria (as regras valem também na API).
 */
function ManagePanel({
  ticket,
  isAdmin,
  currentUserId,
  categories,
  staff,
  onSaved,
}: {
  ticket: TicketDetail;
  isAdmin: boolean;
  currentUserId: number;
  categories: Category[];
  staff: User[];
  onSaved: (ticket: TicketDetail) => void;
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
    const editable = { priority: form.priority, categoryId: Number(form.categoryId) };
    void save(
      isAdmin
        ? { ...editable, status: form.status, assigneeId: form.assigneeId ? Number(form.assigneeId) : null }
        : editable,
    );
  }

  // Suporte só assume chamado sem responsável; a API ajusta o status ao assumir.
  const canAssume = isAdmin ? ticket.assigneeId !== currentUserId : ticket.assigneeId === null;

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
        {canAssume && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={saving}
            onClick={() =>
              save({
                assigneeId: currentUserId,
                ...(isAdmin && ticket.status === "aberto" ? { status: "em_andamento" as const } : {}),
              })
            }
          >
            Assumir chamado
          </button>
        )}
        {isAdmin && (
          <>
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
                {staff.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.id === currentUserId ? " (você)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
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
      </form>
    </section>
  );
}

function AttachmentLink({ attachment, onError }: { attachment: TicketAttachment; onError: (error: ApiError) => void }) {
  const [downloading, setDownloading] = useState(false);

  async function onClick() {
    setDownloading(true);
    try {
      await ticketService.downloadAttachment(attachment);
    } catch (err) {
      onError(err as ApiError);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button type="button" className="attachment" onClick={onClick} disabled={downloading}>
      <span aria-hidden="true">📎</span> {attachment.originalName}{" "}
      <span className="attachment-size">({formatBytes(attachment.sizeBytes)})</span>
    </button>
  );
}

function ResolvePanel({ ticketId, onResolved }: { ticketId: number; onResolved: (ticket: TicketDetail) => void }) {
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function onResolve() {
    if (!window.confirm("Marcar este chamado como resolvido?")) return;
    setSaving(true);
    setError(null);
    try {
      onResolved(await ticketService.resolve(ticketId));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="resolve-title">
      <div className="panel-head">
        <h2 id="resolve-title">Problema resolvido?</h2>
      </div>
      <div className="form">
        <ErrorAlert error={error} />
        <button type="button" className="btn btn-primary" onClick={onResolve} disabled={saving}>
          {saving ? "Salvando…" : "Marcar como resolvido"}
        </button>
      </div>
    </section>
  );
}
