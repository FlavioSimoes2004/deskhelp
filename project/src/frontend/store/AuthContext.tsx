import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT, TOKEN_KEY, tokenStore } from "../services/api";
import { authService } from "../services/deskhelp";
import type { User } from "../services/types";

/** Por que a sessão terminou sem o usuário clicar em "Sair" (mostrado na tela de login). */
export type LogoutReason = "idle" | "replaced" | "expired";

const LOGOUT_REASON_KEY = "deskhelp.logoutReason";

/** Lê e apaga o motivo do último logout automático (uma vez só). */
export function takeLogoutReason(): LogoutReason | null {
  try {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY) as LogoutReason | null;
    sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
  } catch {
    return null;
  }
}

export interface AuthState {
  user: User | null;
  /** true enquanto a sessão salva ainda está sendo verificada. */
  loading: boolean;
  isAdmin: boolean;
  /** Admin ou suporte: veem todos os chamados e atendem. */
  isStaff: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  /** Sem motivo: o usuário saiu. "idle": inatividade (também encerra no servidor). */
  logout: (reason?: LogoutReason) => void;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const logout = useCallback((reason?: LogoutReason) => {
    // Saída pelo usuário ou por inatividade encerra a sessão no servidor também; nos
    // outros casos o token já não vale. Não espera a resposta para liberar a tela.
    if (tokenStore.get() && (reason === undefined || reason === "idle")) {
      authService.logout().catch(() => undefined);
    }
    if (reason) {
      try {
        sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
      } catch {
        /* sem armazenamento: a tela de login só não explica o motivo */
      }
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    authService
      .me()
      .then(setUser)
      .catch(() => logout("expired"))
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    const onExpired = (e: Event) =>
      logout((e as CustomEvent<string>).detail === "SESSION_REPLACED" ? "replaced" : "expired");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  // Outras abas do mesmo navegador: sair numa aba sai em todas; entrar (inclusive com
  // outra conta) atualiza o usuário nas demais. O evento "storage" só chega às outras abas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY && e.key !== null) return;
      if (!tokenStore.get()) {
        setUser(null);
        return;
      }
      authService
        .me()
        .then(setUser)
        .catch(() => setUser(null));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      isStaff: user?.role === "admin" || user?.role === "support",
      login: async (email, password) => {
        const result = await authService.login(email, password);
        tokenStore.set(result.token);
        setUser(result.user);
      },
      register: async (data) => {
        const result = await authService.register(data);
        tokenStore.set(result.token);
        setUser(result.user);
      },
      logout,
      setUser,
    }),
    [user, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
