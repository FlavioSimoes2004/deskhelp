import type { Role } from "../models/types.js";
import { HttpError } from "../utils/httpError.js";

/** Impede que um admin se tranque para fora do sistema removendo o próprio acesso. */
export function assertCanUpdateUser(
  actorId: number,
  targetId: number,
  patch: { role?: Role; active?: boolean; name?: string },
): void {
  if (actorId !== targetId) return;
  if (patch.role !== undefined && patch.role !== "admin") {
    throw new HttpError(409, "SELF_DEMOTION", "Você não pode remover o seu próprio perfil de administrador");
  }
  if (patch.active === false) {
    throw new HttpError(409, "SELF_DEACTIVATION", "Você não pode desativar a sua própria conta");
  }
}
