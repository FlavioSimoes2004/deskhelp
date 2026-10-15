/**
 * Cor de destaque da aplicação (botões, links, avatar, marcações). A partir de uma
 * cor escolhida calculamos as variações usadas no CSS, garantindo contraste legível:
 * --petrol (preenchimento), --petrol-hover, --petrol-text (links sobre branco),
 * --petrol-strong (texto sobre o fundo suave), --petrol-soft, --petrol-light (sobre o
 * menu escuro) e --on-petrol (texto sobre o preenchimento).
 */

export const DEFAULT_ACCENT = "#0e5e6f";

export const ACCENT_PRESETS = [
  { name: "Petróleo", color: DEFAULT_ACCENT },
  { name: "Azul", color: "#2f5fb3" },
  { name: "Roxo", color: "#6b46c1" },
  { name: "Verde", color: "#1f7a4d" },
  { name: "Vermelho", color: "#b4322b" },
  { name: "Laranja", color: "#c25e10" },
  { name: "Rosa", color: "#b83280" },
  { name: "Grafite", color: "#3f4a5a" },
] as const;

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const INK: Rgb = [27, 36, 51]; // --ink
const RAIL: Rgb = [23, 32, 45]; // --rail

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgbToHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** Mistura a cor com outra: t = 0 mantém a original, t = 1 vira a outra. */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function luminance([r, g, b]: Rgb) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contraste WCAG entre duas cores (1 a 21). */
export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Aproxima a cor de "toward" até atingir o contraste mínimo com "against". */
function untilContrast(color: Rgb, toward: Rgb, against: Rgb, min: number): Rgb {
  for (let t = 0; t <= 1; t += 0.05) {
    const candidate = mix(color, toward, t);
    if (contrast(candidate, against) >= min) return candidate;
  }
  return toward;
}

export type AccentTokens = Record<
  "--petrol" | "--petrol-hover" | "--petrol-text" | "--petrol-strong" | "--petrol-soft" | "--petrol-light" | "--on-petrol",
  string
>;

export function accentTokens(hex: string): AccentTokens | null {
  const base = hexToRgb(hex);
  if (!base) return null;
  const soft = mix(base, WHITE, 0.88);
  return {
    "--petrol": rgbToHex(base),
    "--petrol-hover": rgbToHex(mix(base, BLACK, 0.18)),
    "--petrol-text": rgbToHex(untilContrast(base, BLACK, WHITE, 4.5)),
    "--petrol-strong": rgbToHex(untilContrast(mix(base, BLACK, 0.2), BLACK, soft, 4.5)),
    "--petrol-soft": rgbToHex(soft),
    "--petrol-light": rgbToHex(untilContrast(base, WHITE, RAIL, 4.5)),
    "--on-petrol": contrast(base, WHITE) >= contrast(base, INK) ? "#ffffff" : rgbToHex(INK),
  };
}

const STORAGE_KEY = "deskhelp.accent";

/** Aplica a cor no documento; a cor padrão volta aos valores definidos no CSS. */
export function applyAccent(hex: string) {
  const root = document.documentElement.style;
  const tokens = accentTokens(hex);
  for (const name of Object.keys(accentTokens(DEFAULT_ACCENT)!)) root.removeProperty(name);
  if (!tokens || hex.toLowerCase() === DEFAULT_ACCENT) return;
  for (const [name, value] of Object.entries(tokens)) root.setProperty(name, value);
}

export function loadAccent(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && hexToRgb(saved) ? saved : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(hex: string) {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    /* sem armazenamento: a cor vale até recarregar a página */
  }
}
