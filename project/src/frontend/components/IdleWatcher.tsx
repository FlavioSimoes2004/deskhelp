import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const WARN_AFTER_MS = 25 * 60_000;
const LOGOUT_AFTER_MS = 30 * 60_000;
/** Última atividade, compartilhada entre as abas do navegador (usar uma aba mantém as outras). */
const STORAGE_KEY = "deskhelp.lastActivity";
/** Grava a atividade no máximo a cada 5 s (mover o mouse dispara muitos eventos). */
const WRITE_EVERY_MS = 5_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

function readStored(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStored(time: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    /* sem armazenamento: vale só a atividade desta aba */
  }
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Desconecta após 30 min sem atividade (mouse, teclado, toque, rolagem) e avisa
 * aos 25 min, com contagem regressiva. Qualquer atividade ou "Continuar conectado"
 * cancela o aviso.
 */
export function IdleWatcher() {
  const { logout } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const markActive = (force = false) => {
      const now = Date.now();
      if (!force && now - lastActivity.current < WRITE_EVERY_MS) return;
      lastActivity.current = now;
      writeStored(now);
      setRemaining(null);
    };
    const onActivity = () => markActive();
    markActive(true);

    const check = () => {
      const idle = Date.now() - Math.max(lastActivity.current, readStored());
      if (idle >= LOGOUT_AFTER_MS) logout("idle");
      else setRemaining(idle >= WARN_AFTER_MS ? LOGOUT_AFTER_MS - idle : null);
    };
    const timer = setInterval(check, 1000);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true, capture: true });
    // Ao voltar para a aba (ou o computador acordar), confere na hora.
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", check);
    };
  }, [logout]);

  const warning = remaining !== null;
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (warning && !el.open) el.showModal();
    if (!warning && el.open) el.close();
  }, [warning]);

  function keepAlive() {
    lastActivity.current = Date.now();
    writeStored(lastActivity.current);
    setRemaining(null);
  }

  return (
    <dialog
      ref={dialog}
      className="idle-warning"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-text"
      // Esc conta como "continuar conectado".
      onCancel={(e) => {
        e.preventDefault();
        keepAlive();
      }}
    >
      <div className="idle-warning-body">
        <h2 id="idle-warning-title">Você está inativo</h2>
        <p id="idle-warning-text">
          Por segurança, você será desconectado em <strong>{mmss(remaining ?? 0)}</strong> se não houver atividade.
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => logout()}>
            Sair agora
          </button>
          <button type="button" className="btn btn-primary" onClick={keepAlive} autoFocus>
            Continuar conectado
          </button>
        </div>
      </div>
    </dialog>
  );
}
