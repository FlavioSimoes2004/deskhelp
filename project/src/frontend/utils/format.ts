import type { TicketPriority, TicketStatus } from "../services/types";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const STATUS_ORDER: TicketStatus[] = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"];

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_ORDER: TicketPriority[] = ["baixa", "media", "alta", "critica"];

/** #42 → "0042": o número do chamado com largura fixa. */
export const ticketNumber = (id: number) => String(id).padStart(4, "0");

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDay = (isoDay: string) => dateOnly.format(new Date(`${isoDay}T12:00:00`));

/** "há 3 horas", "ontem"... */
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "agora há pouco";
}

/** Data local AAAA-MM-DD (para inputs type=date). */
export function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
