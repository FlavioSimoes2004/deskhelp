import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { notifyNotificationsChanged } from "../hooks/useUnreadNotifications";
import { agendaService } from "../services/deskhelp";
import type { AgendaItem } from "../services/types";
import { formatDateTime } from "../utils/format";

/** Disparado ao criar um item na agenda, para o aviso conferir na hora (ex.: marcado para agora). */
export const AGENDA_CHANGED_EVENT = "deskhelp:agenda-changed";
export const notifyAgendaChanged = () => window.dispatchEvent(new Event(AGENDA_CHANGED_EVENT));

const POLL_MS = 30_000;

/**
 * Aviso da agenda sobre a tela: quando chega a hora de um item, ele aparece aqui e
 * só some quando o usuário dispensa (Esc não fecha). Confere a cada 30 s, ao trocar
 * de página e quando um item é criado.
 */
export function AgendaReminder() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    agendaService
      .due()
      .then((due) => {
        setItems(due);
        // A notificação do item é criada junto; o sino precisa saber.
        if (due.length > 0) notifyNotificationsChanged();
      })
      .catch(() => {
        /* falha momentânea: tenta de novo na próxima conferência */
      });
  }, []);

  useEffect(refresh, [refresh, pathname]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    window.addEventListener(AGENDA_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener(AGENDA_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (items.length > 0 && !el.open) el.showModal();
    if (items.length === 0 && el.open) el.close();
  }, [items.length]);

  async function dismiss(ids: number[]) {
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => agendaService.dismiss(id)));
      setItems((current) => current.filter((i) => !ids.includes(i.id)));
      notifyNotificationsChanged();
    } catch {
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="agenda-reminder"
      aria-labelledby="agenda-reminder-title"
      // Só fecha ao dispensar: Esc não some com o aviso.
      onCancel={(e) => e.preventDefault()}
    >
      <div className="agenda-reminder-body">
        <h2 id="agenda-reminder-title">
          <span aria-hidden="true">⏰</span> {items.length === 1 ? "Lembrete da agenda" : `${items.length} lembretes da agenda`}
        </h2>
        <ul className="agenda-reminder-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span className="muted">{formatDateTime(item.scheduledAt)}</span>
                {item.description && <p>{item.description}</p>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => dismiss([item.id])}>
                Dispensar
              </button>
            </li>
          ))}
        </ul>
        {items.length > 1 && (
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => dismiss(items.map((i) => i.id))}>
              Dispensar todos
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
