type Cell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Evita injeção de fórmulas ao abrir o arquivo em planilhas.
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}
