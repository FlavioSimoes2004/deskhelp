import type { NotificationQuery } from "../middlewares/schemas.js";
import * as notifications from "../models/notificationModel.js";
import type { AuthUser } from "../models/types.js";
import { notFound } from "../utils/httpError.js";

export async function listNotifications(user: AuthUser, query: NotificationQuery) {
  const { page, pageSize, status, type } = query;
  const read = status === undefined ? undefined : status === "read";
  const [{ items, total }, unread] = await Promise.all([
    notifications.listNotifications(user.id, { read, type }, page, pageSize),
    notifications.countUnread(user.id),
  ]);
  return {
    data: items,
    unread,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export const countUnread = (user: AuthUser) => notifications.countUnread(user.id);

export async function setRead(user: AuthUser, id: number, read: boolean) {
  // 404 também para notificação de outra pessoa.
  if (!(await notifications.setRead(user.id, id, read))) throw notFound("Notificação não encontrada");
  return { unread: await notifications.countUnread(user.id) };
}

export async function markAllRead(user: AuthUser) {
  await notifications.markAllRead(user.id);
  return { unread: 0 };
}
