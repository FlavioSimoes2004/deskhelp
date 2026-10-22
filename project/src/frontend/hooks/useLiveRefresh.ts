import { useEffect, useRef } from "react";

/** Intervalo das atualizações automáticas da tela (notificações, agenda, chamados). */
export const LIVE_REFRESH_MS = 15_000;

/**
 * Chama `refresh` a cada LIVE_REFRESH_MS enquanto a aba está visível, e na hora em
 * que o usuário volta para a aba/janela. Não recarrega a página: quem chama decide o
 * que buscar (em geral, `refresh` do useAsync, que troca os dados sem piscar a tela).
 */
export function useLiveRefresh(refresh: () => void, enabled = true) {
  // Sempre a versão mais nova da função, sem reiniciar o intervalo a cada render.
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = setInterval(run, LIVE_REFRESH_MS);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
    };
  }, [enabled]);
}
