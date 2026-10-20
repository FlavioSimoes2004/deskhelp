import { useState, type FormEvent } from "react";
import { notifyAgendaChanged } from "../components/AgendaReminder";
import { EmptyState, ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { ApiError } from "../services/api";
import { agendaService } from "../services/deskhelp";
import type { AgendaItem } from "../services/types";
import { formatDateTime, isoDay } from "../utils/format";

type When = "upcoming" | "past" | "";

/** Situação do item: agendado, aguardando o usuário dispensar ou dispensado. */
function status(item: AgendaItem) {
  if (item.dismissedAt) return { label: "Dispensado", className: "tag tag-muted" };
  if (new Date(item.scheduledAt).getTime() <= Date.now()) return { label: "Aguardando dispensa", className: "tag tag-alert" };
  return { label: "Agendado", className: "tag" };
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Próxima hora cheia, como sugestão inicial do horário. */
function nextHour() {
  const d = new Date(Date.now() + 3_600_000);
  return { date: isoDay(d), time: `${pad(d.getHours())}:00` };
}

export function AgendaPage() {
  const [when, setWhen] = useState<When>("upcoming");
  const items = useAsync(() => agendaService.list(when), [when]);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p>Crie lembretes com data e hora. Na hora marcada, um aviso aparece na tela e nas suas notificações.</p>
        </div>
      </div>

      <AgendaForm
        onCreated={(item) => {
          setNotice(`Lembrete “${item.title}” agendado para ${formatDateTime(item.scheduledAt)}.`);
          notifyAgendaChanged();
          void items.reload();
        }}
      />

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
                const s = status(item);
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
                    </td>
                    <td>
                      <span className={s.className}>{s.label}</span>
                    </td>
                    <td className="num">
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
                      )}
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

function AgendaForm({ onCreated }: { onCreated: (item: AgendaItem) => void }) {
  const [form, setForm] = useState(() => ({ title: "", description: "", ...nextHour() }));
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const item = await agendaService.create({
        title: form.title,
        description: form.description.trim() || null,
        scheduledAt: `${form.date}T${form.time}`,
      });
      setForm({ title: "", description: "", ...nextHour() });
      onCreated(item);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <div className="panel-head">
        <h2>Novo lembrete</h2>
      </div>
      <ErrorAlert error={error && !error.details.length ? error : null} />
      <Field label="Título" error={error?.fieldError("title")}>
        <input
          className="input"
          value={form.title}
          maxLength={160}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Ex.: Ligar para o fornecedor da impressora"
        />
      </Field>
      <Field label="Descrição" hint="Opcional." error={error?.fieldError("description")}>
        <textarea
          className="textarea"
          rows={3}
          value={form.description}
          maxLength={2000}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <div className="form-row">
        <Field label="Data" error={error?.fieldError("scheduledAt")}>
          <input
            className="input"
            type="date"
            value={form.date}
            min={isoDay(new Date())}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </Field>
        <Field label="Hora">
          <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </Field>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim() || !form.date || !form.time}>
          {saving ? "Salvando…" : "Agendar lembrete"}
        </button>
      </div>
    </form>
  );
}
