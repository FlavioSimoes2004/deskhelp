import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { notificationService } from "../services/deskhelp";

/** Disparado quando notificações são lidas na página, para o sino atualizar na hora. */
export const NOTIFICATIONS_CHANGED_EVENT = "deskhelp:notifications-changed";

export const notifyNotificationsChanged = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));

const POLL_MS = 30_000;

/** Quantidade de notificações não lidas: atualiza a cada 30 s, ao trocar de página e após leituras. */
export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    notificationService
      .unreadCount()
      .then(setUnread)
      .catch(() => {
        /* falha momentânea: mantém o último valor */
      });
  }, []);

  useEffect(refresh, [refresh, pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return unread;
}
