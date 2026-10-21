export const ROLES = ["admin", "comum", "support"] as const;
export type Role = (typeof ROLES)[number];

export const TICKET_STATUSES = ["aberto", "em_andamento", "aguardando", "resolvido", "fechado"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const NOTIFICATION_TYPES = ["assigned", "comment", "agenda"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const TICKET_PRIORITIES = ["baixa", "media", "alta", "critica"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Usuário autenticado extraído do JWT. */
export interface AuthUser {
  id: number;
  role: Role;
}

/** Dados do token: o usuário e a sessão (login) em que ele foi emitido. */
export interface TokenClaims extends AuthUser {
  sessionId: string | null;
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
  machineId: number | null;
  machineName: string | null;
  machineMacAddress: string | null;
  machineDescription: string | null;
  solution: string | null;
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

export const STORAGE_TYPES = ["ssd", "hd"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export interface Machine {
  id: number;
  name: string | null;
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  /** Memória RAM: quantidade em GB e qual é (ex.: "DDR4 3200 MHz"). */
  ramGb: number | null;
  ramType: string | null;
  cpu: string | null;
  /** Armazenamento: quantidade em GB e tipo (SSD ou HD). */
  storageGb: number | null;
  storageType: StorageType | null;
  gpu: string | null;
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
  /** Chamado e autor: presentes em "assigned" e "comment"; null em "agenda". */
  ticketId: number | null;
  ticketTitle: string | null;
  actorId: number | null;
  actorName: string | null;
  commentId: number | null;
  /** Início do comentário, para notificações do tipo "comment". */
  commentExcerpt: string | null;
  /** Item da agenda, para notificações do tipo "agenda". */
  agendaId: number | null;
  agendaTitle: string | null;
  agendaScheduledAt: Date | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface AgendaItem {
  id: number;
  /** Chamado vinculado (opcional). */
  ticketId: number | null;
  ticketTitle: string | null;
  title: string;
  description: string | null;
  scheduledAt: Date;
  /** Quando o aviso foi gerado (chegou a hora); null se ainda não chegou. */
  notifiedAt: Date | null;
  /** Quando o usuário dispensou o aviso. */
  dismissedAt: Date | null;
  createdAt: Date;
}
