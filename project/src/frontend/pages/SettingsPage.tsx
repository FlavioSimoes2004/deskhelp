import { useEffect, useState, type FormEvent } from "react";
import { ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { ApiError } from "../services/api";
import { settingsService } from "../services/deskhelp";

/** Configurações gerais da aplicação (só admin). Valem na hora, para todos. */
export function SettingsPage() {
  const settings = useAsync(() => settingsService.get(), []);
  const [form, setForm] = useState({
    hidePriorityForComum: false,
    priorityByStaffOnly: false,
    blockSupportUserManagement: false,
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
                  Eles deixam de ver a prioridade nos chamados e na lista, e de escolhê-la ao abrir um chamado (fica
                  “Média”). Admin e suporte continuam vendo e alterando.
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
                  Usuários comuns abrem chamados sem prioridade; admin ou suporte define depois, no painel “Atendimento”.
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
                  Só administradores cadastram, alteram, desativam ou trocam a senha de usuários. O suporte continua vendo a
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
                  Ninguém consegue enviar comentários, notas internas ou anexos nos chamados, inclusive administradores.
                  O que já foi escrito continua visível.
                </small>
              </span>
            </label>
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
            <button className="btn btn-primary" type="submit" disabled={saving || (form.limitEnabled && !form.limit)}>
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
