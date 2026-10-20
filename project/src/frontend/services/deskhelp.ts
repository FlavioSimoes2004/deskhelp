import { api } from "./api";
import type {
  AgendaItem,
  Category,
  Machine,
  MachineHistoryEntry,
  MachineReport,
  Notification,
  NotificationType,
  Pagination,
  PeopleReport,
  ReportSummary,
  Role,
  StatusCounts,
  Ticket,
  TicketAttachment,
  TicketDetail,
  TicketPriority,
  TicketStatus,
  User,
} from "./types";

interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  config: () => api.get<{ allowSignup: boolean }>("/auth/config"),
  login: (email: string, password: string) => api.post<AuthResponse>("/auth/login", { email, password }),
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>("/auth/register", data),
  me: () => api.get<{ data: User }>("/auth/me").then((r) => r.data),
  updateMe: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    api.patch<{ data: User }>("/auth/me", data).then((r) => r.data),
};

export interface TicketFilters {
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  categoryId?: number | "";
  assigneeId?: number | "";
  search?: string;
  page?: number;
  pageSize?: number;
}

export const ticketService = {
  list: (filters: TicketFilters) =>
    api.get<{ data: Ticket[]; pagination: Pagination }>("/tickets", { ...filters }),
  overview: () =>
    api
      .get<{ data: { byStatus: StatusCounts; assignedToMe?: StatusCounts } }>("/tickets/overview")
      .then((r) => r.data),
  get: (id: number) => api.get<{ data: TicketDetail }>(`/tickets/${id}`).then((r) => r.data),
  create: (data: { title: string; description: string; categoryId: number; priority: TicketPriority }) =>
    api.post<{ data: Ticket }>("/tickets", data).then((r) => r.data),
  update: (
    id: number,
    data: Partial<{
      title: string;
      description: string;
      status: TicketStatus;
      priority: TicketPriority;
      categoryId: number;
      assigneeId: number | null;
      machineId: number | null;
    }>,
  ) => api.patch<{ data: TicketDetail }>(`/tickets/${id}`, data).then((r) => r.data),
  comment: (id: number, body: string, files: File[] = []) => {
    if (files.length === 0) {
      return api.post<{ data: TicketDetail }>(`/tickets/${id}/comments`, { body }).then((r) => r.data);
    }
    const form = new FormData();
    form.append("body", body);
    for (const file of files) form.append("attachments", file);
    return api.postForm<{ data: TicketDetail }>(`/tickets/${id}/comments`, form).then((r) => r.data);
  },
  /** Responsável ou admin, com o chamado resolvido; null/vazio remove a solução. */
  setSolution: (id: number, solution: string | null) =>
    api.put<{ data: TicketDetail }>(`/tickets/${id}/solution`, { solution }).then((r) => r.data),
  resolve: (id: number) => api.post<{ data: TicketDetail }>(`/tickets/${id}/resolve`).then((r) => r.data),
  attachmentBlob: (attachment: TicketAttachment) => api.blob(`/attachments/${attachment.id}`),
  downloadAttachment: (attachment: TicketAttachment) =>
    api.download(`/attachments/${attachment.id}`, {}, attachment.originalName),
  categories: () => api.get<{ data: Category[] }>("/categories").then((r) => r.data),
};

export const userService = {
  list: (filters: { search?: string; role?: Role | ""; active?: "true" | "false" | "" } = {}) =>
    api.get<{ data: User[] }>("/users", filters).then((r) => r.data),
  /** Administradores e suporte (possíveis responsáveis por chamados). */
  staff: () => api.get<{ data: User[] }>("/users/staff").then((r) => r.data),
  create: (data: { name: string; email: string; password: string; role: Role }) =>
    api.post<{ data: User }>("/users", data).then((r) => r.data),
  update: (id: number, data: Partial<{ name: string; email: string; role: Role; active: boolean; password: string }>) =>
    api.patch<{ data: User }>(`/users/${id}`, data).then((r) => r.data),
};

export interface MachineInput {
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  userId: number | null;
}

export const machineService = {
  list: (search = "") => api.get<{ data: Machine[] }>("/machines", { search }).then((r) => r.data),
  create: (data: MachineInput) => api.post<{ data: Machine }>("/machines", data).then((r) => r.data),
  update: (id: number, data: Partial<MachineInput>) =>
    api.patch<{ data: Machine }>(`/machines/${id}`, data).then((r) => r.data),
  history: (id: number) =>
    api.get<{ data: MachineHistoryEntry[] }>(`/machines/${id}/history`).then((r) => r.data),
};

export interface NotificationFilters {
  status?: "unread" | "read" | "";
  type?: NotificationType | "";
  page?: number;
  pageSize?: number;
}

export const notificationService = {
  list: (filters: NotificationFilters) =>
    api.get<{ data: Notification[]; unread: number; pagination: Pagination }>("/notifications", { ...filters }),
  unreadCount: () => api.get<{ data: { unread: number } }>("/notifications/unread-count").then((r) => r.data.unread),
  setRead: (id: number, read: boolean) =>
    api.patch<{ data: { unread: number } }>(`/notifications/${id}`, { read }).then((r) => r.data.unread),
  readAll: () => api.post<{ data: { unread: number } }>("/notifications/read-all").then((r) => r.data.unread),
};

export const agendaService = {
  list: (filters: { when?: "upcoming" | "past" | ""; ticketId?: number } = {}) =>
    api.get<{ data: AgendaItem[] }>("/agenda", { ...filters }).then((r) => r.data),
  /** scheduledAt no formato do campo datetime-local: AAAA-MM-DDTHH:MM; ticketId vincula a um chamado. */
  create: (data: { title: string; description: string | null; scheduledAt: string; ticketId?: number | null }) =>
    api.post<{ data: AgendaItem }>("/agenda", data).then((r) => r.data),
  remove: (id: number) => api.delete(`/agenda/${id}`),
  /** Itens cuja hora chegou e ainda não foram dispensados (avisos na tela). */
  due: () => api.get<{ data: AgendaItem[] }>("/agenda/due").then((r) => r.data),
  dismiss: (id: number) => api.post<void>(`/agenda/${id}/dismiss`),
};

export const reportService = {
  summary: (from: string, to: string) =>
    api.get<{ data: ReportSummary }>("/reports/summary", { from, to }).then((r) => r.data),
  machines: (from: string, to: string) =>
    api.get<{ data: MachineReport }>("/reports/machines", { from, to }).then((r) => r.data),
  /** Por quem abriu ("requesters") ou por responsável ("assignees"). */
  people: (kind: "requesters" | "assignees", from: string, to: string) =>
    api.get<{ data: PeopleReport }>(`/reports/${kind}`, { from, to }).then((r) => r.data),
  exportCsv: (from: string, to: string) =>
    api.download("/reports/tickets.csv", { from, to }, `chamados_${from}_a_${to}.csv`),
};
