/**
 * Situação do token frente à conta:
 * - "ok": conta ativa e o token é da sessão atual;
 * - "replaced": houve um login mais novo em outro lugar (este token caiu);
 * - "invalid": conta inexistente/desativada, sessão encerrada ou token sem sessão.
 */
export function sessionStatus(
  tokenSessionId: string | null,
  user: { active: boolean; sessionId: string | null } | null,
): "ok" | "replaced" | "invalid" {
  if (!user || !user.active || !user.sessionId || !tokenSessionId) return "invalid";
  return tokenSessionId === user.sessionId ? "ok" : "replaced";
}
