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
  ticketId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: number;
  userName: string;
  field: "title" | "description" | "status" | "priority" | "categoryId" | "assigneeId";
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
