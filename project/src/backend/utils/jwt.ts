import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ROLES, type AuthUser, type TokenClaims } from "../models/types.js";

/** sessionId (sid) amarra o token ao login que o gerou; um login novo invalida os anteriores. */
export function signToken(user: AuthUser, sessionId: string): string {
  return jwt.sign({ role: user.role, sid: sessionId }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

/** Retorna o usuário e a sessão do token, ou null se for inválido/expirado. */
export function verifyToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) return null;
    const role = (payload as { role?: unknown }).role;
    if (!ROLES.includes(role as AuthUser["role"])) return null;
    const sid = (payload as { sid?: unknown }).sid;
    return { id: Number(payload.sub), role: role as AuthUser["role"], sessionId: typeof sid === "string" ? sid : null };
  } catch {
    return null;
  }
}
