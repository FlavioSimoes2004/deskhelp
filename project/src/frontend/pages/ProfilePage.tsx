import { useState, type FormEvent } from "react";
import { ErrorAlert } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { authService } from "../services/deskhelp";
import { ROLE_LABEL } from "../utils/format";

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const changingPassword = Boolean(passwords.next);
  const confirmError =
    passwords.confirm && passwords.confirm !== passwords.next ? "As senhas não são iguais" : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (confirmError) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await authService.updateMe({
        name,
        ...(changingPassword ? { currentPassword: passwords.current, newPassword: passwords.next } : {}),
      });
      setUser(updated);
      setPasswords({ current: "", next: "", confirm: "" });
      setNotice(changingPassword ? "Perfil e senha atualizados." : "Perfil atualizado.");
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1>Meu perfil</h1>
          <p>
            {user.email}, perfil {ROLE_LABEL[user.role].toLowerCase()}.
          </p>
        </div>
      </div>
      <form className="panel form" onSubmit={onSubmit} noValidate>
        {notice && (
          <div className="alert alert-ok" role="status">
            {notice}
          </div>
        )}
        <ErrorAlert error={error && !error.details.length ? error : null} />
        <Field label="Nome" error={error?.fieldError("name")}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <h2 style={{ marginTop: 8 }}>Trocar senha</h2>
        <Field label="Senha atual" error={error?.fieldError("currentPassword")}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={passwords.current}
            onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label="Nova senha" hint="Pelo menos 8 caracteres." error={error?.fieldError("newPassword")}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
            />
          </Field>
          <Field label="Confirme a nova senha" error={confirmError}>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </Field>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !!confirmError}>
            {saving ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </form>
    </div>
  );
}
