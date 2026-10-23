import * as users from "../models/userModel.js";
import type { AuthUser, PublicUser, Role } from "../models/types.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { hashPassword } from "../utils/password.js";
import { getSettings } from "./settingsService.js";
import { assertCanWriteUsers } from "./settingsRules.js";
import { assertCanManageUser, assertCanUpdateUser } from "./userRules.js";

export const listUsers = users.listUsers;
export const listStaff = users.listStaff;

export async function createUser(actor: AuthUser, data: { name: string; email: string; password: string; role: Role }) {
  assertCanWriteUsers(actor, await getSettings());
  assertCanManageUser(actor, null, data);
  if (await users.findUserByEmail(data.email)) {
    throw new HttpError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const id = await users.insertUser({ ...data, passwordHash: await hashPassword(data.password) });
  return getUser(id);
}

export async function getUser(id: number): Promise<PublicUser> {
  const user = await users.findUserById(id);
  if (!user) throw notFound("Usuário não encontrado");
  // Nunca devolve o hash da senha nem a sessão atual.
  const { passwordHash: _hash, sessionId: _session, ...rest } = user;
  return rest;
}

export async function updateUser(
  actor: AuthUser,
  id: number,
  data: { name?: string; email?: string; role?: Role; active?: boolean; password?: string },
) {
  assertCanWriteUsers(actor, await getSettings());
  const target = await getUser(id);
  assertCanManageUser(actor, target, data);
  assertCanUpdateUser(actor, id, data);
  if (data.email) {
    const other = await users.findUserByEmail(data.email);
    if (other && other.id !== id) throw new HttpError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const { password, ...rest } = data;
  await users.updateUser(id, { ...rest, passwordHash: password ? await hashPassword(password) : undefined });
  return getUser(id);
}
