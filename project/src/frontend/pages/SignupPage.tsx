import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AuthFrame } from "../components/AuthFrame";
import { ErrorAlert, Loading } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { authService } from "../services/deskhelp";

export function SignupPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const config = useAsync(() => authService.config(), []);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (config.loading) return <Loading />;
  if (config.data && !config.data.allowSignup) return <Navigate to="/login" replace />;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const confirmError = form.confirm && form.confirm !== form.password ? "As senhas não são iguais" : undefined;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (confirmError) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame>
      <h1>Criar conta</h1>
      <p>Com a conta você abre chamados e acompanha cada um até a solução.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <ErrorAlert error={error && !error.details.length ? error : null} />
        <Field label="Nome completo" error={error?.fieldError("name")}>
          <input className="input" autoComplete="name" value={form.name} onChange={set("name")} required autoFocus />
        </Field>
        <Field label="E-mail" error={error?.fieldError("email")}>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        </Field>
        <Field label="Senha" hint="Pelo menos 8 caracteres." error={error?.fieldError("password")}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            required
          />
        </Field>
        <Field label="Confirme a senha" error={confirmError}>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
            required
          />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={submitting || !!confirmError}>
          {submitting ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
      <p className="switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthFrame>
  );
}
