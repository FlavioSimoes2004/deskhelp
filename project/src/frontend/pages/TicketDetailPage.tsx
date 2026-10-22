import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";
import { PriorityTag, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { ImagePreview, isImageAttachment } from "../components/ImagePreview";
import { TicketAgendaPanel } from "../components/TicketAgendaPanel";
import { TicketStub } from "../components/TicketStub";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { ApiError } from "../services/api";
import { machineService, ticketService, userService } from "../services/deskhelp";
import type {
  Category,
  Machine,
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
import { machineLabel } from "../utils/machine";


function describeChange(
  entry: TicketHistoryEntry,
  categories: Category[],
  users: User[],
  machines: Machine[],
  ticket: TicketDetail,
): string {
  const userName = (id: string | null) => (id ? (users.find((u) => String(u.id) === id)?.name ?? `#${id}`) : null);
  // Usuário comum não lista máquinas; ainda assim reconhece a máquina atual do chamado.
  const machineName = (id: string) => {
    const machine = machines.find((m) => String(m.id) === id);
    if (machine) return machineLabel(machine);
    if (id === String(ticket.machineId) && ticket.machineMacAddress) {
      return machineLabel({
        name: ticket.machineName,
        macAddress: ticket.machineMacAddress,
        description: ticket.machineDescription,
      });
    }
    return `#${id}`;
  };
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
    case "machineId":
      return entry.newValue ? `vinculou a máquina ${machineName(entry.newValue)}` : "removeu a máquina vinculada";
    case "solution":
      if (!entry.newValue) return "removeu a solução";
      return entry.oldValue ? "editou a solução" : "registrou a solução";
  }
}

export function TicketDetailPage() {
  const id = Number(useParams().id);
  const { user, isAdmin, isStaff } = useAuth();
  const justCreated = Boolean((useLocation().state as { created?: boolean } | null)?.created);

  const ticket = useAsync(() => ticketService.get(id), [id]);
  const categories = useAsync(() => ticketService.categories(), []);
  const staff = useAsync(() => (isStaff ? userService.staff() : Promise.resolve([])), [isStaff]);
  const machines = useAsync(() => (isStaff ? machineService.list() : Promise.resolve([])), [isStaff]);

  const loadedId = ticket.data?.id;
  useEffect(() => {
    if (loadedId !== undefined) notifyNotificationsChanged();
  }, [loadedId]);

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
  // Nota interna: qualquer admin ou suporte (em chamado fechado, só admin).
  const canInternal = isStaff && (isAdmin || t.status !== "fechado");
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
          <SolutionPanel
            ticket={t}
            canEdit={isAdmin || (user !== null && t.assigneeId === user.id)}
            onSaved={(updated) => ticket.setData(updated)}
          />
          <RatingPanel
            ticket={t}
            canRate={user !== null && t.requesterId === user.id}
            onRated={(updated) => ticket.setData(updated)}
          />
          <Conversation
            ticket={t}
            blockedReason={commentBlocked}
            canInternal={canInternal}
            categories={categories.data ?? []}
            staff={staff.data ?? []}
            machines={machines.data ?? []}
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
              machines={machines.data ?? []}
              onSaved={(updated) => ticket.setData(updated)}
            />
          ) : null}
          {user?.role === "comum" && t.requesterId === user.id && t.status !== "resolvido" && t.status !== "fechado" && (
            <ResolvePanel
              ticketId={t.id}
              hasMachine={t.machineId !== null}
              onResolved={(updated) => ticket.setData(updated)}
            />
          )}
          <TicketAgendaPanel ticketId={t.id} />
          <section className="panel" aria-labelledby="info-title">
            <div className="panel-head">
              <h2 id="info-title">Informações</h2>
            </div>
            <dl className="meta-list">
              <dt>Responsável</dt>
              <dd>{t.assigneeName ?? "Ainda não atribuído"}</dd>
              <dt>Máquina</dt>
              <dd>
                {t.machineMacAddress
                  ? machineLabel({ name: t.machineName, macAddress: t.machineMacAddress, description: t.machineDescription })
                  : "Não vinculada"}
              </dd>
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
  blockedReason,
  canInternal,
  categories,
  staff,
  machines,
  onCommented,
}: {
  ticket: TicketDetail;
  /** Motivo pelo qual o usuário não pode responder; null quando pode. */
  blockedReason: string | null;
  /** Pode escrever notas internas (admin/suporte). */
  canInternal: boolean;
  categories: Category[];
  staff: User[];
  machines: Machine[];
  onCommented: (ticket: TicketDetail) => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);
  // Sem poder responder normalmente, a equipe ainda pode deixar nota interna.
  const internalOnly = blockedReason !== null && canInternal;
  const [internalChoice, setInternalChoice] = useState(false);
  const internal = internalOnly || (canInternal && internalChoice);

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
      onCommented(await ticketService.comment(ticket.id, body, files, internal));
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
                  {item.c.internal && (
                    <span className="tag tag-alert" title="Visível só para administradores e suporte">
                      Nota interna
                    </span>
                  )}{" "}
                  <span className="muted" style={{ color: "var(--ink-3)", fontSize: "var(--step--1)" }} title={formatDateTime(item.at)}>
                    {timeAgo(item.at)}
                  </span>
                  <div className={item.c.internal ? "comment-body internal" : "comment-body"}>{item.c.body}</div>
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
                  <strong>{item.h.userName}</strong> {describeChange(item.h, categories, staff, machines, ticket)}, {timeAgo(item.at)}
                </span>
              </li>
            ),
          )}
        </ol>
      )}

      {blockedReason !== null && (
        <p className="alert alert-ok" style={{ marginTop: 20 }}>
          {blockedReason}
          {internalOnly && " Você ainda pode deixar uma nota interna para a equipe."}
        </p>
      )}
      {blockedReason === null || canInternal ? (
        <form className="form" onSubmit={onSubmit} style={{ marginTop: 20 }}>
          <ErrorAlert error={error} />
          {canInternal && (
            <label className="internal-toggle">
              <input
                type="checkbox"
                checked={internal}
                disabled={internalOnly}
                onChange={(e) => setInternalChoice(e.target.checked)}
              />
              Nota interna: visível só para administradores e suporte
            </label>
          )}
          <Field label={internal ? "Nota interna" : "Responder"}>
            <textarea
              className="textarea"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={internal ? "Anotação para a equipe (quem abriu não vê)" : "Escreva uma atualização ou pergunta"}
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
              {sending ? "Enviando…" : internal ? "Salvar nota interna" : "Enviar resposta"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

/**
 * Atendimento do chamado. Admin altera tudo; suporte só assume chamados sem
 * responsável e altera prioridade, categoria e máquina (as regras valem também na API).
 * Para marcar como "resolvido", o chamado precisa ter máquina vinculada.
 */
function ManagePanel({
  ticket,
  isAdmin,
  currentUserId,
  categories,
  staff,
  machines,
  onSaved,
}: {
  ticket: TicketDetail;
  isAdmin: boolean;
  currentUserId: number;
  categories: Category[];
  staff: User[];
  machines: Machine[];
  onSaved: (ticket: TicketDetail) => void;
}) {
  const initial = useMemo(
    () => ({
      status: ticket.status,
      priority: ticket.priority,
      categoryId: String(ticket.categoryId),
      assigneeId: ticket.assigneeId ? String(ticket.assigneeId) : "",
      machineId: ticket.machineId ? String(ticket.machineId) : "",
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
    const editable = {
      priority: form.priority,
      categoryId: Number(form.categoryId),
      machineId: form.machineId ? Number(form.machineId) : null,
    };
    void save(
      isAdmin
        ? { ...editable, status: form.status, assigneeId: form.assigneeId ? Number(form.assigneeId) : null }
        : editable,
    );
  }

  // Suporte só assume chamado sem responsável; a API ajusta o status ao assumir.
  const canAssume = isAdmin ? ticket.assigneeId !== currentUserId : ticket.assigneeId === null;

  // Máquinas que podem ser vinculadas: as que estão com quem abriu o chamado ou sem usuário.
  // A máquina já vinculada continua na lista, para o campo não ficar em branco.
  const machineOptions = machines.filter(
    (m) => m.userId === null || m.userId === ticket.requesterId || m.id === ticket.machineId,
  );

  return (
    <section className="panel" aria-labelledby="manage-title">
      <div className="panel-head">
        <h2 id="manage-title">Atendimento</h2>
      </div>
      <form className="form" onSubmit={onSubmit}>
        {/* O erro de máquina aparece no próprio campo. */}
        <ErrorAlert error={error?.fieldError("machineId") ? null : error} />
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
        <Field
          label="Máquina"
          hint={
            machineOptions.length === 0
              ? `Nenhuma máquina com ${ticket.requesterName} ou sem usuário. Cadastre ou ajuste em Máquinas.`
              : form.machineId
                ? "Só aparecem máquinas de quem abriu o chamado ou sem usuário."
                : "Obrigatória para marcar o chamado como resolvido. Só aparecem máquinas de quem abriu o chamado ou sem usuário."
          }
          error={error?.fieldError("machineId")}
        >
          <select className="select" value={form.machineId} onChange={(e) => setForm({ ...form, machineId: e.target.value })}>
            <option value="">Nenhuma máquina</option>
            {machineOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {machineLabel(m)}
                {m.userName ? ` - ${m.userName}` : ""}
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
  const [previewing, setPreviewing] = useState(false);
  const isImage = isImageAttachment(attachment);

  async function onClick() {
    // Imagens abrem em pré-visualização; os demais arquivos são baixados.
    if (isImage) return setPreviewing(true);
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
    <>
      <button
        type="button"
        className="attachment"
        onClick={onClick}
        disabled={downloading}
        aria-haspopup={isImage ? "dialog" : undefined}
        title={isImage ? "Ver imagem" : "Baixar arquivo"}
      >
        <span aria-hidden="true">{isImage ? "🖼️" : "📎"}</span> {attachment.originalName}{" "}
        <span className="attachment-size">({formatBytes(attachment.sizeBytes)})</span>
      </button>
      {previewing && <ImagePreview attachment={attachment} onClose={() => setPreviewing(false)} />}
    </>
  );
}

function ResolvePanel({
  ticketId,
  hasMachine,
  onResolved,
}: {
  ticketId: number;
  /** Chamado só pode ser resolvido com máquina vinculada (feito pelo suporte). */
  hasMachine: boolean;
  onResolved: (ticket: TicketDetail) => void;
}) {
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
        {hasMachine ? (
          <button type="button" className="btn btn-primary" onClick={onResolve} disabled={saving}>
            {saving ? "Salvando…" : "Marcar como resolvido"}
          </button>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Para marcar como resolvido, o suporte precisa primeiro vincular a máquina a este chamado.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Solução do chamado: visível a todos que veem o chamado; o responsável ou um admin
 * registra/edita com o chamado resolvido (a API aplica as mesmas regras).
 */
function SolutionPanel({
  ticket,
  canEdit,
  onSaved,
}: {
  ticket: TicketDetail;
  canEdit: boolean;
  onSaved: (ticket: TicketDetail) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(ticket.solution ?? "");
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const isResolved = ticket.status === "resolvido";

  // Fora do modo de edição, acompanha o valor salvo (ex.: depois de recarregar o chamado).
  useEffect(() => {
    if (!editing) setText(ticket.solution ?? "");
  }, [ticket.solution, editing]);

  // Sem solução e sem permissão de registrar: o painel não aparece.
  if (!ticket.solution && !canEdit) return null;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await ticketService.setSolution(ticket.id, text.trim() || null));
      setEditing(false);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="solution-title">
      <div className="panel-head">
        <h2 id="solution-title">Solução</h2>
        {canEdit && isResolved && !editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            {ticket.solution ? "Editar solução" : "Registrar solução"}
          </button>
        )}
      </div>
      {editing ? (
        <form className="form" onSubmit={onSave}>
          <ErrorAlert error={error} />
          <Field label="Como o problema foi resolvido" hint="Deixe em branco e salve para remover a solução.">
            <textarea
              className="textarea"
              rows={5}
              value={text}
              maxLength={10000}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar solução"}
            </button>
          </div>
        </form>
      ) : ticket.solution ? (
        <p className="description">{ticket.solution}</p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {isResolved
            ? "Nenhuma solução registrada ainda."
            : "A solução poderá ser registrada quando o chamado estiver resolvido."}
        </p>
      )}
    </section>
  );
}

const RATING_LABEL = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Ótimo"];

/** Estrelas de 1 a 5 só para leitura. */
function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={n <= value ? "star on" : "star"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Avaliação do atendimento: quem abriu avalia (1 a 5 e comentário opcional) quando o
 * chamado está resolvido ou fechado, uma vez. Depois, todos que veem o chamado veem a nota.
 */
function RatingPanel({
  ticket,
  canRate,
  onRated,
}: {
  ticket: TicketDetail;
  canRate: boolean;
  onRated: (ticket: TicketDetail) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const finished = ticket.status === "resolvido" || ticket.status === "fechado";

  if (ticket.rating === null && !(canRate && finished)) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setSaving(true);
    setError(null);
    try {
      onRated(await ticketService.rate(ticket.id, rating, comment.trim() || null));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="rating-title">
      <div className="panel-head">
        <h2 id="rating-title">Avaliação do atendimento</h2>
      </div>
      {ticket.rating !== null ? (
        <div>
          <p style={{ margin: 0 }}>
            <Stars value={ticket.rating} /> <strong>{RATING_LABEL[ticket.rating]}</strong>
            {ticket.ratedAt && (
              <span className="muted" style={{ color: "var(--ink-3)", fontSize: "var(--step--1)" }}>
                {" "}
                · {formatDateTime(ticket.ratedAt)}
              </span>
            )}
          </p>
          {ticket.ratingComment && <p className="description" style={{ marginTop: 8 }}>{ticket.ratingComment}</p>}
        </div>
      ) : (
        <form className="form" onSubmit={onSubmit}>
          <ErrorAlert error={error} />
          <fieldset className="star-picker">
            <legend>Como foi o atendimento?</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} title={RATING_LABEL[n]} className={n <= rating ? "on" : undefined}>
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="visually-hidden"
                />
                <span aria-hidden="true">★</span>
                <span className="visually-hidden">
                  {n} {n === 1 ? "estrela" : "estrelas"}: {RATING_LABEL[n]}
                </span>
              </label>
            ))}
            <span className="star-picker-label">{rating ? RATING_LABEL[rating] : "Escolha de 1 a 5"}</span>
          </fieldset>
          <Field label="Comentário" hint="Opcional. A avaliação não pode ser alterada depois.">
            <textarea
              className="textarea"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={!rating || saving}>
              {saving ? "Enviando…" : "Enviar avaliação"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
