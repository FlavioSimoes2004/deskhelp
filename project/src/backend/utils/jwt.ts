import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ROLES, type AuthUser } from "../models/types.js";

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  });
}

/** Retorna o usuário do token ou null se for inválido/expirado. */
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) return null;
    const role = (payload as { role?: unknown }).role;
    if (!ROLES.includes(role as AuthUser["role"])) return null;
    return { id: Number(payload.sub), role: role as AuthUser["role"] };
  } catch {
    return null;
  }
}
