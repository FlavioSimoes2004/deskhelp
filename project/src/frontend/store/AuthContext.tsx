import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT, tokenStore } from "../services/api";
import { authService } from "../services/deskhelp";
import type { User } from "../services/types";

export interface AuthState {
  user: User | null;
  /** true enquanto a sessão salva ainda está sendo verificada. */
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    authService
      .me()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
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
