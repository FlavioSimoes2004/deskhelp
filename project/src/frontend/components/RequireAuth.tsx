import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "./Feedback";

/** Protege rotas: exige login e, opcionalmente, o perfil admin. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Verificando sua sessão…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
