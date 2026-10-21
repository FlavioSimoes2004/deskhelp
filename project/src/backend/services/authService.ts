import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import {
  clearSessionId,
  findUserByEmail,
  findUserById,
  insertUser,
  setSessionId,
  updateUser,
} from "../models/userModel.js";
import type { PublicUser } from "../models/types.js";
import { HttpError } from "../utils/httpError.js";
import { signToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const withoutHash = ({
  passwordHash: _hash,
  sessionId: _session,
  ...user
}: PublicUser & { passwordHash: string; sessionId: string | null }): PublicUser => user;

/** Abre uma sessão nova para a conta; qualquer sessão anterior (outro navegador) cai. */
async function startSession(user: PublicUser) {
  const sessionId = randomUUID();
  await setSessionId(user.id, sessionId);
  return signToken(user, sessionId);
}

export const endSession = clearSessionId;

const invalidCredentials = () => new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos");

let dummyHash: Promise<string> | undefined;

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  // Compara mesmo sem usuário para não revelar, pelo tempo de resposta, quais e-mails existem.
  dummyHash ??= hashPassword("deskhelp-dummy-password");
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) throw invalidCredentials();
  if (!user.active) throw new HttpError(403, "USER_INACTIVE", "Sua conta está desativada. Fale com um administrador.");
  return { token: await startSession(user), user: withoutHash(user) };
}

export async function register(data: { name: string; email: string; password: string }) {
  if (!env.ALLOW_SIGNUP) throw new HttpError(403, "SIGNUP_DISABLED", "O cadastro público está desativado");
  if (await findUserByEmail(data.email)) {
    throw new HttpError(409, "EMAIL_IN_USE", "Já existe uma conta com este e-mail");
  }
  const id = await insertUser({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    role: "comum",
  });
  const user = await findUserById(id);
  if (!user) throw new Error("Usuário recém-criado não encontrado");
  return { token: await startSession(user), user: withoutHash(user) };
}

export async function getProfile(id: number): Promise<PublicUser> {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "NOT_FOUND", "Usuário não encontrado");
  return withoutHash(user);
}

export async function updateProfile(
  id: number,
  data: { name?: string; currentPassword?: string; newPassword?: string },
): Promise<PublicUser> {
  const user = await findUserById(id);
  if (!user) throw new HttpError(404, "NOT_FOUND", "Usuário não encontrado");
  let passwordHash: string | undefined;
  if (data.newPassword) {
    if (!data.currentPassword || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "WRONG_PASSWORD", "A senha atual está incorreta", [
        { field: "currentPassword", message: "A senha atual está incorreta" },
      ]);
    }
    passwordHash = await hashPassword(data.newPassword);
  }
  await updateUser(id, { name: data.name, passwordHash });
  return getProfile(id);
}
