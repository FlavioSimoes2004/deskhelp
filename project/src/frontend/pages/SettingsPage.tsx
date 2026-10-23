import { useEffect, useState, type FormEvent } from "react";
import { ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { settingsService } from "../services/deskhelp";

/** Configurações gerais da aplicação (admin e super support). Valem na hora, para todos. */
export function SettingsPage() {
  const settings = useAsync(() => settingsService.get(), []);
  const [form, setForm] = useState({
    hidePriorityForComum: false,
    priorityByStaffOnly: false,
    blockSupportUserManagement: false,
    maxTicketAttachments: "5",
    ratingsLocked: false,
    reopenLimited: false,
    reopenHours: "48",
    commentsLocked: false,
    limitEnabled: false,
    limit: "3",
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Preenche o formulário com o que está salvo.
  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({
      hidePriorityForComum: s.hidePriorityForComum,
      priorityByStaffOnly: s.priorityByStaffOnly,
      blockSupportUserManagement: s.blockSupportUserManagement,
      maxTicketAttachments: String(s.maxTicketAttachments),
      ratingsLocked: s.ratingsLocked,
      reopenLimited: s.reopenWindowHours !== null,
      reopenHours: String(s.reopenWindowHours ?? 48),
      commentsLocked: s.commentsLocked,
      limitEnabled: s.maxOpenTicketsPerUser !== null,
      limit: String(s.maxOpenTicketsPerUser ?? 3),
    });
  }, [settings.data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      settings.setData(
        await settingsService.update({
          hidePriorityForComum: form.hidePriorityForComum,
          priorityByStaffOnly: form.priorityByStaffOnly,
          blockSupportUserManagement: form.blockSupportUserManagement,
          maxTicketAttachments: Number(form.maxTicketAttachments),
          ratingsLocked: form.ratingsLocked,
          reopenWindowHours: form.reopenLimited ? Number(form.reopenHours) : null,
          commentsLocked: form.commentsLocked,
          maxOpenTicketsPerUser: form.limitEnabled ? Number(form.limit) : null,
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Regras gerais da aplicação. As mudanças valem na hora, para todos os usuários.</p>
        </div>
      </div>

      <ErrorAlert error={settings.error} onRetry={settings.reload} />
      {settings.loading && !settings.data ? (
        <Loading />
      ) : settings.data ? (
        <form className="panel form" onSubmit={onSubmit} noValidate>
          <ErrorAlert error={error && !error.details.length ? error : null} />
          {saved && (
            <div className="alert alert-ok" role="status">
              Configurações salvas.
            </div>
          )}

          <fieldset className="fieldset">
            <legend>Prioridade dos chamados</legend>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.hidePriorityForComum}
                onChange={(e) => setForm({ ...form, hidePriorityForComum: e.target.checked })}
              />
              <span>
                <strong>Esconder a prioridade de usuários comuns</strong>
                <small>
                  Usuários comuns e administradores (que seguem as regras do comum) deixam de ver a prioridade nos
                  chamados e na lista, e de escolhê-la ao abrir um chamado (fica “Média”). Suporte e super support
                  continuam vendo e alterando.
                </small>
              </span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.priorityByStaffOnly}
                onChange={(e) => setForm({ ...form, priorityByStaffOnly: e.target.checked })}
              />
              <span>
                <strong>Só o suporte define a prioridade</strong>
                <small>
                  Usuários comuns e administradores abrem chamados sem prioridade; o suporte define depois, no painel
                  “Atendimento”.
                  Esses chamados aparecem como “Sem prioridade” e podem ser filtrados assim na lista.
                </small>
              </span>
            </label>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Usuários</legend>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.blockSupportUserManagement}
                onChange={(e) => setForm({ ...form, blockSupportUserManagement: e.target.checked })}
              />
              <span>
                <strong>Proibir o suporte de cadastrar e editar usuários</strong>
                <small>
                  Só o super support cadastra, altera, desativa ou troca a senha de usuários. O suporte continua vendo a
                  lista de usuários (somente leitura).
                </small>
              </span>
            </label>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Conversa nos chamados</legend>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.commentsLocked}
                onChange={(e) => setForm({ ...form, commentsLocked: e.target.checked })}
              />
              <span>
                <strong>Bloquear a conversa</strong>
                <small>
                  Ninguém consegue enviar comentários, notas internas ou anexos nos chamados, inclusive o super support.
                  O que já foi escrito continua visível.
                </small>
              </span>
            </label>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Conclusão do chamado</legend>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.ratingsLocked}
                onChange={(e) => setForm({ ...form, ratingsLocked: e.target.checked })}
              />
              <span>
                <strong>Bloquear a avaliação do atendimento</strong>
                <small>Ninguém consegue avaliar chamados. As avaliações já feitas continuam visíveis e nos relatórios.</small>
              </span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.reopenLimited}
                onChange={(e) => setForm({ ...form, reopenLimited: e.target.checked })}
              />
              <span>
                <strong>Limitar o prazo para reabrir chamados</strong>
                <small>
                  Quem abriu pode reabrir um chamado resolvido (volta para “Em andamento”). Sem limite, pode reabrir a
                  qualquer momento; com limite, só até o prazo abaixo, contado da conclusão.
                </small>
              </span>
            </label>
            {form.reopenLimited && (
              <Field label="Prazo para reabrir (horas)" error={error?.fieldError("reopenWindowHours")}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={8760}
                  step={1}
                  inputMode="numeric"
                  value={form.reopenHours}
                  onChange={(e) => setForm({ ...form, reopenHours: e.target.value })}
                  style={{ maxWidth: 160 }}
                />
              </Field>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend>Anexos ao abrir chamado</legend>
            <Field
              label="Máximo de anexos ao abrir um chamado"
              hint="De 0 a 5 (5 é o máximo por envio aceito pelo servidor). Com 0, o campo de anexos some da página “Abrir chamado”. Não afeta os anexos dos comentários."
              error={error?.fieldError("maxTicketAttachments")}
            >
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                step={1}
                inputMode="numeric"
                value={form.maxTicketAttachments}
                onChange={(e) => setForm({ ...form, maxTicketAttachments: e.target.value })}
                style={{ maxWidth: 160 }}
              />
            </Field>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Chamados por usuário</legend>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={form.limitEnabled}
                onChange={(e) => setForm({ ...form, limitEnabled: e.target.checked })}
              />
              <span>
                <strong>Limitar chamados abertos por usuário</strong>
                <small>
                  Conta os chamados “Aberto” e “Em andamento” de quem abriu. Ao atingir o limite, a pessoa só abre outro
                  quando algum avançar.
                </small>
              </span>
            </label>
            {form.limitEnabled && (
              <Field label="Máximo por usuário" error={error?.fieldError("maxOpenTicketsPerUser")}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  inputMode="numeric"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  style={{ maxWidth: 160 }}
                />
              </Field>
            )}
          </fieldset>

          <div className="form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={
                saving ||
                (form.limitEnabled && !form.limit) ||
                (form.reopenLimited && !form.reopenHours) ||
                form.maxTicketAttachments === ""
              }
            >
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
