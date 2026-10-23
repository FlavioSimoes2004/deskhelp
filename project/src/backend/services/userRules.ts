import type { AuthUser, Role } from "../models/types.js";
import { forbidden, HttpError } from "../utils/httpError.js";
import { isProtectedRole, isSuper } from "./roleRules.js";

/** Impede que alguém se tranque para fora do sistema mudando o próprio perfil ou desativando a conta. */
export function assertCanUpdateUser(
  actor: AuthUser,
  targetId: number,
  patch: { role?: Role; active?: boolean; name?: string },
): void {
  if (actor.id !== targetId) return;
  if (patch.role !== undefined && patch.role !== actor.role) {
    throw new HttpError(409, "SELF_DEMOTION", "Você não pode alterar o seu próprio perfil de acesso");
  }
  if (patch.active === false) {
    throw new HttpError(409, "SELF_DEACTIVATION", "Você não pode desativar a sua própria conta");
  }
}

/**
 * Super suporte gerencia qualquer usuário. Suporte gerencia usuários comuns e de suporte,
 * mas não altera nem cria/promove administradores e super suportes. target é null no cadastro.
 */
export function assertCanManageUser(actor: AuthUser, target: { role: Role } | null, patch: { role?: Role }): void {
  if (isSuper(actor.role)) return;
  if (target && isProtectedRole(target.role)) {
    throw forbidden("O suporte não pode alterar administradores nem super suportes");
  }
  if (patch.role && isProtectedRole(patch.role)) {
    throw forbidden("O suporte não pode criar nem promover administradores ou super suportes");
  }
}
