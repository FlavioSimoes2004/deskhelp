export type Role = "admin" | "comum" | "support";
export type TicketStatus = "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado";
export type TicketPriority = "baixa" | "media" | "alta" | "critica";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId: number;
  categoryName: string;
  requesterId: number;
  requesterName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  machineId: number | null;
  machineMacAddress: string | null;
  machineDescription: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface TicketComment {
  id: number;
  userId: number;
  userName: string;
  body: string;
  createdAt: string;
  attachments: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  commentId: number;
  ticketId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: number;
  userName: string;
  field: "title" | "description" | "status" | "priority" | "categoryId" | "assigneeId" | "machineId";
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface TicketDetail extends Ticket {
  comments: TicketComment[];
  history: TicketHistoryEntry[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type StatusCounts = Partial<Record<TicketStatus, number>>;

export interface CountItem {
  label: string | null;
  total: number;
}

export interface ReportSummary {
  period: { from: string; to: string };
  totals: { total: number; resolved: number; avgResolutionHours: number | null };
  byStatus: CountItem[];
  byPriority: CountItem[];
  byCategory: CountItem[];
  byAssignee: CountItem[];
  perDay: { day: string; total: number }[];
}

export interface Machine {
  id: number;
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  userId: number | null;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MachineHistoryEntry {
  id: number;
  machineId: number;
  userId: number;
  userName: string;
  field: "created" | "macAddress" | "ipAddress" | "description" | "userId";
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export type NotificationType = "assigned" | "comment" | "agenda";

export interface Notification {
  id: number;
  type: NotificationType;
  /** Chamado e autor: presentes em "assigned" e "comment"; null em "agenda". */
  ticketId: number | null;
  ticketTitle: string | null;
  actorId: number | null;
  actorName: string | null;
  commentId: number | null;
  commentExcerpt: string | null;
  agendaId: number | null;
  agendaTitle: string | null;
  agendaScheduledAt: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface MachineReportRow {
  machineId: number;
  macAddress: string;
  description: string | null;
  userName: string | null;
  total: number;
  byStatus: Record<TicketStatus, number>;
  byCategory: { label: string; total: number }[];
}

export interface MachineReport {
  period: { from: string; to: string };
  totals: { withMachine: number; withoutMachine: number; machines: number };
  machines: MachineReportRow[];
  /** Categorias presentes no período, da mais para a menos frequente. */
  categories: string[];
}

export interface PersonReportRow {
  /** null = chamados sem responsável (só no relatório de responsáveis). */
  userId: number | null;
  userName: string | null;
  total: number;
  resolved: number;
  avgResolutionHours: number | null;
  byStatus: Record<TicketStatus, number>;
  byCategory: { label: string; total: number }[];
}

export interface PeopleReport {
  period: { from: string; to: string };
  totals: {
    total: number;
    resolved: number;
    avgResolutionHours: number | null;
    /** Pessoas com ao menos um chamado (sem contar "sem responsável"). */
    people: number;
    /** Chamados sem responsável (sempre 0 no relatório de solicitantes). */
    unassigned: number;
  };
  people: PersonReportRow[];
  categories: string[];
}

export interface AgendaItem {
  id: number;
  title: string;
  description: string | null;
  scheduledAt: string;
  notifiedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}
