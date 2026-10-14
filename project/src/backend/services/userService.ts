import * as users from "../models/userModel.js";
import type { PublicUser, Role } from "../models/types.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { hashPassword } from "../utils/password.js";
import { assertCanUpdateUser } from "./userRules.js";

export const listUsers = users.listUsers;

export async function createUser(data: { name: string; email: string; password: string; role: Role }) {
  if (await users.findUserByEmail(data.email)) {
    throw new HttpError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const id = await users.insertUser({ ...data, passwordHash: await hashPassword(data.password) });
  return getUser(id);
}

export async function getUser(id: number): Promise<PublicUser> {
  const user = await users.findUserById(id);
  if (!user) throw notFound("Usuário não encontrado");
  const { passwordHash: _hash, ...rest } = user;
  return rest;
}

export async function updateUser(
  actorId: number,
  id: number,
  data: { name?: string; email?: string; role?: Role; active?: boolean; password?: string },
) {
  await getUser(id);
  assertCanUpdateUser(actorId, id, data);
  if (data.email) {
    const other = await users.findUserByEmail(data.email);
    if (other && other.id !== id) throw new HttpError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const { password, ...rest } = data;
  await users.updateUser(id, { ...rest, passwordHash: password ? await hashPassword(password) : undefined });
  return getUser(id);
}
