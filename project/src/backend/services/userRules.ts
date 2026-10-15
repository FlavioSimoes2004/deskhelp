import type { AuthUser, Role } from "../models/types.js";
import { forbidden, HttpError } from "../utils/httpError.js";

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
 * Admin gerencia qualquer usuário. Suporte gerencia usuários comuns e de suporte,
 * mas não altera administradores nem cria ou promove alguém a administrador.
 * target é null no cadastro.
 */
export function assertCanManageUser(actor: AuthUser, target: { role: Role } | null, patch: { role?: Role }): void {
  if (actor.role === "admin") return;
  if (target?.role === "admin") throw forbidden("O suporte não pode alterar usuários administradores");
  if (patch.role === "admin") throw forbidden("O suporte não pode criar ou promover administradores");
}
