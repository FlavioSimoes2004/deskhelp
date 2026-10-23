import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorAlert } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAppSettings } from "../hooks/useAppSettings";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { ticketService } from "../services/deskhelp";
import type { TicketPriority } from "../services/types";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "../utils/format";

const PRIORITY_HINT: Record<TicketPriority, string> = {
  baixa: "Incomoda, mas dá para trabalhar normalmente.",
  media: "Atrapalha parte do trabalho.",
  alta: "Impede você de trabalhar.",
  critica: "Afeta várias pessoas ou um sistema essencial.",
};

export function NewTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useAppSettings();
  const categories = useAsync(() => ticketService.categories(), []);
  // Configuração: usuário comum pode não escolher a prioridade (fica sem, ou a padrão).
  // Comum e admin seguem as mesmas regras de prioridade.
  const isComum = user?.role === "comum" || user?.role === "admin";
  const staffSetsPriority = isComum && Boolean(settings?.priorityByStaffOnly);
  const choosePriority = isComum ? !settings?.priorityByStaffOnly && !settings?.hidePriorityForComum : true;
  const [form, setForm] = useState({ title: "", description: "", categoryId: "", priority: "media" as TicketPriority });
  const [files, setFiles] = useState<File[]>([]);
  const maxFiles = settings?.maxTicketAttachments ?? 5;
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await ticketService.create(
        {
          title: form.title,
          description: form.description,
          categoryId: Number(form.categoryId),
          priority: form.priority,
        },
        files,
      );
      navigate(`/chamados/${ticket.id}`, { state: { created: true } });
    } catch (err) {
      setError(err as ApiError);
      setSubmitting(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Abrir chamado</h1>
          <p>Conte o que aconteceu. Quanto mais detalhes, mais rápido o suporte resolve.</p>
        </div>
      </div>

      <form className="panel form" onSubmit={onSubmit} noValidate>
        {settings?.maxOpenTicketsPerUser && (
          <p className="muted" style={{ margin: 0 }}>
            Cada pessoa pode ter até {settings.maxOpenTicketsPerUser}{" "}
            {settings.maxOpenTicketsPerUser === 1 ? "chamado" : "chamados"} aberto(s) ou em andamento ao mesmo tempo.
          </p>
        )}
        <ErrorAlert error={error && !error.details.length ? error : null} />
        <ErrorAlert error={categories.error} onRetry={categories.reload} />
        <Field label="Assunto" hint="Um resumo curto, ex.: “Outlook não envia e-mails”." error={error?.fieldError("title")}>
          <input
            className="input"
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            autoFocus
          />
        </Field>
        <div className="form-row">
          <Field label="Categoria" error={error?.fieldError("categoryId")}>
            <select
              className="select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="" disabled>
                Escolha uma categoria
              </option>
              {categories.data?.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {staffSetsPriority && (
            <p className="muted" style={{ alignSelf: "end", margin: 0 }}>
              A prioridade será definida pela equipe de suporte.
            </p>
          )}
          {choosePriority && (
            <Field label="Prioridade" hint={PRIORITY_HINT[form.priority]} error={error?.fieldError("priority")}>
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
          )}
        </div>
        <Field
          label="Descrição"
          hint="O que você tentou fazer, o que apareceu na tela e desde quando acontece."
          error={error?.fieldError("description")}
        >
          <textarea
            className="textarea"
            rows={8}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />
        </Field>
        {maxFiles > 0 && (
          <Field
            label="Anexos"
            hint={`Opcional. Até ${maxFiles} ${maxFiles === 1 ? "arquivo" : "arquivos"} de 10 MB: imagens (ex.: print do erro), PDF, texto, planilhas, documentos ou ZIP.`}
            error={
              files.length > maxFiles
                ? `Selecione no máximo ${maxFiles} ${maxFiles === 1 ? "arquivo" : "arquivos"}.`
                : error?.fieldError("attachments")
            }
          >
            <input
              className="input"
              type="file"
              multiple={maxFiles > 1}
              accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods,.zip"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Field>
        )}
        <div className="form-actions">
          <Link className="btn btn-ghost" to="/chamados">
            Cancelar
          </Link>
          <button className="btn btn-primary" type="submit" disabled={submitting || !form.categoryId || files.length > maxFiles}>
            {submitting ? "Abrindo…" : "Abrir chamado"}
          </button>
        </div>
      </form>
    </div>
  );
}
