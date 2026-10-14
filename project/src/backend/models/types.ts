export const ROLES = ["admin", "comum"] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

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
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/** Anexo com o caminho do arquivo no servidor (uso interno, não vai para a API). */
export interface StoredAttachment extends TicketAttachment {
  ticketId: number;
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
