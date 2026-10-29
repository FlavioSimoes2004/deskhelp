import { useEffect, useState } from "react";
import { applyColorScheme, saveColorScheme, type ColorScheme } from "../utils/theme";

const current = (): ColorScheme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/**
 * Switch da aparência clara/escura (o sol vira lua). A escolha fica salva neste navegador;
 * até o usuário escolher, a aparência acompanha a do sistema operacional.
 */
export function AppearanceToggle() {
  const [scheme, setScheme] = useState<ColorScheme>(current);

  // Acompanha mudanças feitas fora daqui (ex.: o sistema trocou de aparência).
  useEffect(() => {
    const observer = new MutationObserver(() => setScheme(current()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const dark = scheme === "dark";

  function toggle() {
    const next: ColorScheme = dark ? "light" : "dark";
    applyColorScheme(next);
    saveColorScheme(next);
    setScheme(next);
  }

  return (
    <div className="appearance">
      {/* Rótulo fixo: "Tema escuro" ligado/desligado é inequívoco para leitores de tela. */}
      <span id="appearance-label">Tema escuro</span>
      <button
        type="button"
        role="switch"
        className="mode-switch"
        aria-checked={dark}
        aria-labelledby="appearance-label"
        title={dark ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
        onClick={toggle}
      >
        <span className="mode-switch-knob" aria-hidden="true">
          <span className="mode-icon" />
        </span>
      </button>
    </div>
  );
}
