export const ROLES = ["admin", "comum", "support"] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const NOTIFICATION_TYPES = ["assigned", "comment"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TICKET_PRIORITIES = ["baixa", "media", "alta", "critica"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Usuário autenticado extraído do JWT. */
export interface AuthUser {
  id: number;
  role: Role;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export interface TicketComment {
  id: number;
  ticketId: number;
  userId: number;
  userName: string;
  body: string;
  createdAt: Date;
  attachments: TicketAttachment[];
}

export interface TicketAttachment {
  id: number;
  commentId: number;
  ticketId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/** Anexo com o caminho do arquivo no servidor (uso interno, não vai para a API). */
export interface StoredAttachment extends TicketAttachment {
  filePath: string;
}

export interface TicketHistoryEntry {
  id: number;
  ticketId: number;
  userId: number;
  userName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

export interface Machine {
  id: number;
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  userId: number | null;
  userName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MachineHistoryEntry {
  id: number;
  machineId: number;
  userId: number;
  userName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

export interface Notification {
  id: number;
  type: NotificationType;
  ticketId: number;
  ticketTitle: string;
  actorId: number;
  actorName: string;
  commentId: number | null;
  /** Início do comentário, para notificações do tipo "comment". */
  commentExcerpt: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}
