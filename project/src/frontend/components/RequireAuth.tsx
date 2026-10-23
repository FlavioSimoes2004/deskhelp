import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "./Feedback";

/**
 * Protege rotas: exige login e, opcionalmente, um perfil: staff (suporte e super support),
 * administration (admin e super support) ou superSupport (só super support).
 */
export function RequireAuth({
  children,
  staff = false,
  administration = false,
  superSupport = false,
}: {
  children: ReactNode;
  staff?: boolean;
  administration?: boolean;
  superSupport?: boolean;
}) {
  const { user, loading, isSuper, isStaff, canAdministrate } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Verificando sua sessão…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (staff && !isStaff) return <Navigate to="/" replace />;
  if (administration && !canAdministrate) return <Navigate to="/" replace />;
  if (superSupport && !isSuper) return <Navigate to="/" replace />;
  return <>{children}</>;
}
