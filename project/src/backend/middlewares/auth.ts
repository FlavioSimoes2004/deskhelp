import type { NextFunction, Request, Response } from "express";
import { findUserById } from "../models/userModel.js";
import type { AuthUser, Role } from "../models/types.js";
import { sessionStatus } from "../services/sessionRules.js";
import { forbidden, HttpError } from "../utils/httpError.js";
import { verifyToken } from "../utils/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    /** Sessão (login) do token usado nesta requisição. */
    sessionId?: string;
  }
}

const unauthorized = () => new HttpError(401, "UNAUTHORIZED", "Faça login para continuar");

/**
 * Valida o Bearer token e recarrega o usuário do banco, assim uma conta
 * desativada ou com perfil alterado perde o acesso imediatamente. O token
 * também precisa ser da sessão atual da conta: um login em outro lugar
 * substitui a sessão e este token recebe 401 SESSION_REPLACED.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const claims = token ? verifyToken(token) : null;
  if (!claims) return next(unauthorized());

  const user = await findUserById(claims.id);
  const status = sessionStatus(claims.sessionId, user);
  if (status === "replaced") {
    return next(
      new HttpError(401, "SESSION_REPLACED", "Sua conta foi acessada em outro lugar. Entre novamente para continuar."),
    );
  }
  if (status !== "ok" || !user || !claims.sessionId) return next(unauthorized());
  req.user = { id: user.id, role: user.role };
  req.sessionId = claims.sessionId;
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };

/** Atalho para handlers que rodam depois de authenticate. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
