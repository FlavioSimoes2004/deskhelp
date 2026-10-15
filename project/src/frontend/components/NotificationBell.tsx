import { NavLink } from "react-router";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications";

/** Sino com a quantidade de notificações não lidas; leva para a página de notificações. */
export function NotificationBell() {
  const unread = useUnreadNotifications();
  const label = unread === 0 ? "Notificações" : `Notificações: ${unread} não ${unread === 1 ? "lida" : "lidas"}`;
  return (
    <NavLink to="/notificacoes" className="bell" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && <span className="bell-count">{unread > 99 ? "99+" : unread}</span>}
    </NavLink>
  );
}
