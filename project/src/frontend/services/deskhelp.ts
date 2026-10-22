import { api } from "./api";
import type {
  AgendaItem,
  AppSettings,
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
  StorageType,
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
  /** Encerra a sessão no servidor (o token deixa de valer). */
  logout: () => api.post<void>("/auth/logout"),
  updateMe: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    api.patch<{ data: User }>("/auth/me", data).then((r) => r.data),
};

export interface TicketFilters {
  status?: TicketStatus | "";
  priority?: TicketPriority | "";
  categoryId?: number | "";
  assigneeId?: number | "";
  search?: string;
  /** Período pela data de abertura (AAAA-MM-DD, inclusivo). */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const ticketService = {
  list: (filters: TicketFilters) =>
    api.get<{ data: Ticket[]; pagination: Pagination }>("/tickets", { ...filters }),
  /** Data (AAAA-MM-DD) do chamado aberto/em andamento mais antigo visível; null se não houver. */
  oldestOpenDate: () => api.get<{ data: { date: string | null } }>("/tickets/oldest-open").then((r) => r.data.date),
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
  /** internal = nota interna (só admin e suporte veem). */
  comment: (id: number, body: string, files: File[] = [], internal = false) => {
    if (files.length === 0) {
      return api.post<{ data: TicketDetail }>(`/tickets/${id}/comments`, { body, internal }).then((r) => r.data);
    }
    const form = new FormData();
    form.append("body", body);
    form.append("internal", String(internal));
    for (const file of files) form.append("attachments", file);
    return api.postForm<{ data: TicketDetail }>(`/tickets/${id}/comments`, form).then((r) => r.data);
  },
  /** Responsável ou admin, com o chamado resolvido; null/vazio remove a solução. */
  setSolution: (id: number, solution: string | null) =>
    api.put<{ data: TicketDetail }>(`/tickets/${id}/solution`, { solution }).then((r) => r.data),
  /** Quem abriu avalia o atendimento (1 a 5), com o chamado resolvido ou fechado. */
  rate: (id: number, rating: number, comment: string | null) =>
    api.post<{ data: TicketDetail }>(`/tickets/${id}/rating`, { rating, comment }).then((r) => r.data),
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

export interface MachineFilters {
  /** Busca geral (nome, MAC, IP, descrição, configuração, usuário). */
  search?: string;
  name?: string;
  cpu?: string;
  gpu?: string;
  ramType?: string;
  /** Mínimo em GB. */
  ramGbMin?: number | "";
  storageGbMin?: number | "";
  storageType?: StorageType | "";
}

export interface MachineInput {
  name: string | null;
  macAddress: string;
  ipAddress: string | null;
  description: string | null;
  ramGb: number | null;
  ramType: string | null;
  cpu: string | null;
  storageGb: number | null;
  storageType: StorageType | null;
  gpu: string | null;
  userId: number | null;
}

export const machineService = {
  list: (filters: MachineFilters = {}) =>
    api.get<{ data: Machine[] }>("/machines", { ...filters }).then((r) => r.data),
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
  /** Só lembretes que ainda não tocaram. */
  update: (id: number, data: { title?: string; description?: string | null; scheduledAt?: string }) =>
    api.patch<{ data: AgendaItem }>(`/agenda/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/agenda/${id}`),
  /** Itens cuja hora chegou e ainda não foram dispensados (avisos na tela). */
  due: () => api.get<{ data: AgendaItem[] }>("/agenda/due").then((r) => r.data),
  dismiss: (id: number) => api.post<void>(`/agenda/${id}/dismiss`),
};

export const settingsService = {
  get: () => api.get<{ data: AppSettings }>("/settings").then((r) => r.data),
  /** Só admin. */
  update: (data: Partial<AppSettings>) => api.put<{ data: AppSettings }>("/settings", data).then((r) => r.data),
};

export const reportService = {
  summary: (from: string, to: string) =>
    api.get<{ data: ReportSummary }>("/reports/summary", { from, to }).then((r) => r.data),
  machines: (from: string, to: string) =>
    api.get<{ data: MachineReport }>("/reports/machines", { from, to }).then((r) => r.data),
  exportMachinesCsv: (from: string, to: string) =>
    api.download("/reports/machines.csv", { from, to }, `maquinas_${from}_a_${to}.csv`),
  exportPeopleCsv: (kind: "requesters" | "assignees", from: string, to: string) =>
    api.download(`/reports/${kind}.csv`, { from, to }, `${kind === "requesters" ? "solicitantes" : "responsaveis"}_${from}_a_${to}.csv`),
  /** Por quem abriu ("requesters") ou por responsável ("assignees"). */
  people: (kind: "requesters" | "assignees", from: string, to: string) =>
    api.get<{ data: PeopleReport }>(`/reports/${kind}`, { from, to }).then((r) => r.data),
  exportCsv: (from: string, to: string) =>
    api.download("/reports/tickets.csv", { from, to }, `chamados_${from}_a_${to}.csv`),
};
