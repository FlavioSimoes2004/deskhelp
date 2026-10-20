import { useState, type FormEvent } from "react";
import { ApiError } from "../services/api";
import { agendaService } from "../services/deskhelp";
import type { AgendaItem } from "../services/types";
import { isoDay } from "../utils/format";
import { ErrorAlert } from "./Feedback";
import { Field } from "./Field";

const pad = (n: number) => String(n).padStart(2, "0");
/** Próxima hora cheia, como sugestão inicial do horário. */
function nextHour() {
  const d = new Date(Date.now() + 3_600_000);
  return { date: isoDay(d), time: `${pad(d.getHours())}:00` };
}

/** Situação do item: agendado, aguardando o usuário dispensar ou dispensado. */
export function agendaStatus(item: AgendaItem) {
  if (item.dismissedAt) return { label: "Dispensado", className: "tag tag-muted" };
  if (new Date(item.scheduledAt).getTime() <= Date.now()) return { label: "Aguardando dispensa", className: "tag tag-alert" };
  return { label: "Agendado", className: "tag" };
}

/** Formulário de novo lembrete; com ticketId, o lembrete fica vinculado ao chamado. */
export function AgendaForm({
  ticketId,
  onCreated,
  onCancel,
}: {
  ticketId?: number;
  onCreated: (item: AgendaItem) => void;
  onCancel?: () => void;
}) {
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
        ticketId: ticketId ?? null,
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
        <h2>{ticketId ? "Novo lembrete para este chamado" : "Novo lembrete"}</h2>
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
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving || !form.title.trim() || !form.date || !form.time}>
          {saving ? "Salvando…" : "Agendar lembrete"}
        </button>
      </div>
    </form>
  );
}
