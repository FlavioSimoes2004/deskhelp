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

/** Lembrete editável: a hora ainda não chegou (e o aviso ainda não foi gerado). */
export const isAgendaEditable = (item: AgendaItem) =>
  item.notifiedAt === null && new Date(item.scheduledAt).getTime() > Date.now();

/** Data e hora local do item, no formato dos campos do formulário. */
function splitLocal(iso: string) {
  const d = new Date(iso);
  return { date: isoDay(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/**
 * Formulário de lembrete. Sem item: cria (com ticketId, vinculado ao chamado).
 * Com item: edita título, descrição, data e hora de um lembrete que ainda não tocou.
 */
export function AgendaForm({
  ticketId,
  item,
  onCreated,
  onCancel,
}: {
  ticketId?: number;
  item?: AgendaItem;
  onCreated: (item: AgendaItem) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(() =>
    item
      ? { title: item.title, description: item.description ?? "", ...splitLocal(item.scheduledAt) }
      : { title: "", description: "", ...nextHour() },
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data = {
      title: form.title,
      description: form.description.trim() || null,
      scheduledAt: `${form.date}T${form.time}`,
    };
    try {
      if (item) {
        onCreated(await agendaService.update(item.id, data));
        return;
      }
      const created = await agendaService.create({ ...data, ticketId: ticketId ?? null });
      setForm({ title: "", description: "", ...nextHour() });
      onCreated(created);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <div className="panel-head">
        <h2>{item ? `Editar “${item.title}”` : ticketId ? "Novo lembrete para este chamado" : "Novo lembrete"}</h2>
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
          {saving ? "Salvando…" : item ? "Salvar alterações" : "Agendar lembrete"}
        </button>
      </div>
    </form>
  );
}
