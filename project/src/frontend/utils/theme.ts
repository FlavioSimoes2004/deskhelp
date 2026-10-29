/**
 * Cor de destaque da aplicação (botões, links, avatar, marcações). A partir de uma
 * cor escolhida calculamos as variações usadas no CSS, garantindo contraste legível:
 * --petrol (preenchimento), --petrol-hover, --petrol-text (links sobre branco),
 * --petrol-strong (texto sobre o fundo suave), --petrol-soft e --on-petrol (texto sobre
 * o preenchimento).
 */

/** systemBlue, a cor de destaque padrão da Apple. */
export const DEFAULT_ACCENT = "#007aff";

/** As cores de destaque do macOS (Ajustes > Aparência). */
export const ACCENT_PRESETS = [
  { name: "Azul", color: DEFAULT_ACCENT },
  { name: "Roxo", color: "#af52de" },
  { name: "Rosa", color: "#ff2d55" },
  { name: "Vermelho", color: "#ff3b30" },
  { name: "Laranja", color: "#ff9500" },
  { name: "Amarelo", color: "#ffcc00" },
  { name: "Verde", color: "#34c759" },
  { name: "Grafite", color: "#8e8e93" },
] as const;

/** Aparência: clara ou escura. */
export type ColorScheme = "light" | "dark";

/**
 * No modo escuro a Apple usa versões mais claras das cores do sistema (ex.: systemBlue
 * #007AFF vira #0A84FF). Cores personalizadas são usadas como foram escolhidas.
 */
const DARK_VARIANT: Record<string, string> = {
  "#007aff": "#0a84ff",
  "#af52de": "#bf5af2",
  "#ff2d55": "#ff375f",
  "#ff3b30": "#ff453a",
  "#ff9500": "#ff9f0a",
  "#ffcc00": "#ffd60a",
  "#34c759": "#30d158",
  "#8e8e93": "#98989d",
};

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
// Texto escuro usado sobre cores claras (amarelo, verde...). Mantido levemente azulado: com um
// preto mais puro, a comparação de contraste passaria a escolher texto escuro no systemBlue.
const INK: Rgb = [27, 36, 51];
// Fundos do modo escuro: cartão (#1C1C1E), onde ficam links e etiquetas.
const DARK_SURFACE: Rgb = [28, 28, 30];

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
  "--petrol" | "--petrol-hover" | "--petrol-text" | "--petrol-strong" | "--petrol-soft" | "--on-petrol",
  string
>;

/** Variações da cor para a aparência; no escuro, links e etiquetas clareiam (contraste com o fundo escuro). */
export function accentTokens(hex: string, scheme: ColorScheme = "light"): AccentTokens | null {
  if (scheme === "dark") {
    const base = hexToRgb(DARK_VARIANT[hex.toLowerCase()] ?? hex);
    if (!base) return null;
    const soft = mix(base, DARK_SURFACE, 0.78);
    return {
      "--petrol": rgbToHex(base),
      "--petrol-hover": rgbToHex(mix(base, WHITE, 0.14)),
      "--petrol-text": rgbToHex(untilContrast(base, WHITE, DARK_SURFACE, 4.5)),
      "--petrol-strong": rgbToHex(untilContrast(mix(base, WHITE, 0.25), WHITE, soft, 4.5)),
      "--petrol-soft": rgbToHex(soft),
      "--on-petrol": contrast(base, WHITE) >= contrast(base, INK) ? "#ffffff" : rgbToHex(INK),
    };
  }
  const base = hexToRgb(hex);
  if (!base) return null;
  const soft = mix(base, WHITE, 0.88);
  return {
    "--petrol": rgbToHex(base),
    "--petrol-hover": rgbToHex(mix(base, BLACK, 0.18)),
    "--petrol-text": rgbToHex(untilContrast(base, BLACK, WHITE, 4.5)),
    "--petrol-strong": rgbToHex(untilContrast(mix(base, BLACK, 0.2), BLACK, soft, 4.5)),
    "--petrol-soft": rgbToHex(soft),
    "--on-petrol": contrast(base, WHITE) >= contrast(base, INK) ? "#ffffff" : rgbToHex(INK),
  };
}

const STORAGE_KEY = "deskhelp.accent";

/** Aparência atual do documento (definida por applyColorScheme). */
const currentScheme = (): ColorScheme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Aplica a cor no documento, com as variações da aparência atual. */
export function applyAccent(hex: string) {
  const root = document.documentElement.style;
  const tokens = accentTokens(hex, currentScheme()) ?? accentTokens(DEFAULT_ACCENT, currentScheme())!;
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

const SCHEME_KEY = "deskhelp.colorScheme";

/** Aparência escolhida pelo usuário; sem escolha, a do sistema operacional. */
export function loadColorScheme(): ColorScheme {
  try {
    const saved = localStorage.getItem(SCHEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* sem armazenamento: segue o sistema */
  }
  return systemColorScheme();
}

export const systemColorScheme = (): ColorScheme =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/** O usuário já escolheu uma aparência (deixa de seguir o sistema). */
export function hasSavedColorScheme(): boolean {
  try {
    return localStorage.getItem(SCHEME_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveColorScheme(scheme: ColorScheme) {
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    /* sem armazenamento: vale até recarregar a página */
  }
}

/** Aplica a aparência (CSS em [data-theme]) e recalcula a cor de destaque para ela. */
export function applyColorScheme(scheme: ColorScheme) {
  document.documentElement.dataset.theme = scheme;
  document.documentElement.style.colorScheme = scheme;
  applyAccent(loadAccent());
}
