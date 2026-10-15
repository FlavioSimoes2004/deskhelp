import { useId, useState } from "react";
import { ACCENT_PRESETS, applyAccent, hexToRgb, loadAccent, saveAccent } from "../utils/theme";

/** Escolha da cor da aplicação: cores prontas ou qualquer cor RGB. Fica salva neste navegador. */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [accent, setAccent] = useState(loadAccent);
  const panelId = useId();
  const isPreset = ACCENT_PRESETS.some((p) => p.color === accent);
  const [r, g, b] = hexToRgb(accent) ?? [0, 0, 0];

  function choose(hex: string) {
    const color = hex.toLowerCase();
    setAccent(color);
    applyAccent(color);
    saveAccent(color);
  }

  return (
    <div className="theme-picker">
      <button
        type="button"
        className="btn btn-rail btn-sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-dot" style={{ background: accent }} aria-hidden="true" />
        Cor do tema
      </button>
      {open && (
        <div id={panelId} className="theme-panel">
          <div className="theme-swatches" role="group" aria-label="Cores prontas">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                className="theme-swatch"
                style={{ background: p.color }}
                aria-label={p.name}
                aria-pressed={accent === p.color}
                title={p.name}
                onClick={() => choose(p.color)}
              />
            ))}
          </div>
          <label className="theme-custom">
            <input type="color" value={accent} onChange={(e) => choose(e.target.value)} />
            <span>
              {isPreset ? "Outra cor (RGB)" : "Cor personalizada"}
              <small>
                rgb({r}, {g}, {b})
              </small>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
