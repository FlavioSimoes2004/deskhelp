import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { AuthFrame } from "../components/AuthFrame";
import { ErrorAlert } from "../components/Feedback";
import { Field } from "../components/Field";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import { authService } from "../services/deskhelp";
import { takeLogoutReason, type LogoutReason } from "../store/AuthContext";

const LOGOUT_MESSAGE: Record<LogoutReason, string> = {
  idle: "Você foi desconectado após 30 minutos sem atividade. Entre novamente para continuar.",
  replaced:
    "Sua conta foi acessada em outro lugar e esta sessão foi encerrada. Ao entrar aqui de novo, a outra sessão é que será encerrada.",
  expired: "Sua sessão expirou. Entre novamente para continuar.",
};

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const config = useAsync(() => authService.config(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Motivo do logout automático, lido uma vez ao abrir a tela.
  const [reason] = useState(takeLogoutReason);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame>
      <h1>Entrar</h1>
      <p>Use o e-mail e a senha da sua conta DeskHelp.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {reason && !error && (
          <div className="alert alert-warn" role="status">
            {LOGOUT_MESSAGE[reason]}
          </div>
        )}
        <ErrorAlert error={error && !error.details.length ? error : null} />
        <Field label="E-mail" error={error?.fieldError("email")}>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Senha" error={error?.fieldError("password")}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
      {config.data?.allowSignup && (
        <p className="switch">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      )}
    </AuthFrame>
  );
}
