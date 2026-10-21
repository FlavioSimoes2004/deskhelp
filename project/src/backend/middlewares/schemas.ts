import { isIP } from "node:net";
import { z } from "zod";
import { LOCAL_DATETIME } from "../services/agendaRules.js";
import { NOTIFICATION_TYPES, ROLES, STORAGE_TYPES, TICKET_PRIORITIES, TICKET_STATUSES } from "../models/types.js";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido").max(190));
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(128);
const name = z.string().trim().min(2, "Informe o nome").max(120);
const id = z.coerce.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha"),
});

export const registerSchema = z.object({ name, email, password });

export const updateProfileSchema = z
  .object({
    name: name.optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  })
  .refine((data) => !data.newPassword || data.currentPassword, {
    message: "Informe a senha atual para definir uma nova",
    path: ["currentPassword"],
  });

export const createUserSchema = z.object({
  name,
  email,
  password,
  role: z.enum(ROLES).default("comum"),
});

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    role: z.enum(ROLES).optional(),
    active: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nenhum campo para atualizar" });

export const userQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(5, "O título precisa ter pelo menos 5 caracteres").max(160),
  description: z.string().trim().min(10, "Descreva o problema com pelo menos 10 caracteres").max(10000),
  priority: z.enum(TICKET_PRIORITIES).default("media"),
  categoryId: id,
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(5).max(160).optional(),
    description: z.string().trim().min(10).max(10000).optional(),
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    categoryId: id.optional(),
    assigneeId: id.nullable().optional(),
    machineId: id.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nenhum campo para atualizar" });

export const solutionSchema = z.object({
  // Vazio remove a solução.
  solution: z
    .string()
    .trim()
    .max(10000, "A solução pode ter no máximo 10000 caracteres")
    .nullable()
    .transform((v) => v || null),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva o comentário").max(5000),
});

export const ticketQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  categoryId: id.optional(),
  assigneeId: id.optional(),
  search: z.string().trim().max(100).optional(),
  // Período pela data de abertura (AAAA-MM-DD, inclusivo).
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, 100)),
});

// Aceita AA:BB:CC:DD:EE:FF, AA-BB-..., AABB.CCDD.EEFF ou só os 12 dígitos; grava como AA:BB:CC:DD:EE:FF.
const macAddress = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s:.-]/g, "").toUpperCase())
  .refine((v) => /^[0-9A-F]{12}$/.test(v), "Endereço MAC inválido")
  .transform((v) => v.match(/.{2}/g)!.join(":"));

// Vazio vira null (máquina sem IP fixo).
const ipAddress = z
  .string()
  .trim()
  .max(45)
  .nullable()
  .transform((v) => v || null)
  .refine((v) => v === null || isIP(v) !== 0, "Endereço IP inválido");

// Vazio vira null (máquina sem descrição).
const machineDescription = z
  .string()
  .trim()
  .max(255, "A descrição pode ter no máximo 255 caracteres")
  .nullable()
  .transform((v) => v || null);

/** Texto opcional da máquina: vazio vira null. */
const machineText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} pode ter no máximo ${max} caracteres`)
    .nullable()
    .transform((v) => v || null);

/** Quantidade em GB (inteiro positivo) ou null. */
const gigabytes = (max: number, label: string) =>
  z.number().int(`${label}: use um número inteiro de GB`).min(1, `${label}: informe ao menos 1 GB`).max(max).nullable();

const machineSpecs = {
  name: machineText(80, "O nome"),
  ramGb: gigabytes(65_535, "Memória RAM"),
  ramType: machineText(120, "O tipo de memória"),
  cpu: machineText(120, "O processador"),
  storageGb: gigabytes(10_000_000, "Armazenamento"),
  storageType: z.enum(STORAGE_TYPES).nullable(),
  gpu: machineText(120, "A placa de vídeo"),
};

export const createMachineSchema = z.object({
  macAddress,
  ipAddress: ipAddress.default(null),
  description: machineDescription.default(null),
  userId: id.nullable().default(null),
  name: machineSpecs.name.default(null),
  ramGb: machineSpecs.ramGb.default(null),
  ramType: machineSpecs.ramType.default(null),
  cpu: machineSpecs.cpu.default(null),
  storageGb: machineSpecs.storageGb.default(null),
  storageType: machineSpecs.storageType.default(null),
  gpu: machineSpecs.gpu.default(null),
});

export const updateMachineSchema = z
  .object({
    macAddress: macAddress.optional(),
    ipAddress: ipAddress.optional(),
    description: machineDescription.optional(),
    userId: id.nullable().optional(),
    name: machineSpecs.name.optional(),
    ramGb: machineSpecs.ramGb.optional(),
    ramType: machineSpecs.ramType.optional(),
    cpu: machineSpecs.cpu.optional(),
    storageGb: machineSpecs.storageGb.optional(),
    storageType: machineSpecs.storageType.optional(),
    gpu: machineSpecs.gpu.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nenhum campo para atualizar" });

const textFilter = z.string().trim().max(100).optional();
const minGb = z.coerce.number().int().min(1).optional();

export const machineQuerySchema = z.object({
  search: textFilter,
  // Filtros por coluna: texto contém; GB = mínimo.
  name: textFilter,
  cpu: textFilter,
  gpu: textFilter,
  ramType: textFilter,
  ramGbMin: minGb,
  storageGbMin: minGb,
  storageType: z.enum(STORAGE_TYPES).optional(),
});

export type MachineQuery = z.infer<typeof machineQuerySchema>;

export const notificationQuerySchema = z.object({
  status: z.enum(["unread", "read"]).optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, 100)),
});

export const updateNotificationSchema = z.object({ read: z.boolean() });

export const createAgendaSchema = z.object({
  title: z.string().trim().min(3, "O título precisa ter pelo menos 3 caracteres").max(160),
  description: z
    .string()
    .trim()
    .max(2000, "A descrição pode ter no máximo 2000 caracteres")
    .nullable()
    .optional()
    .transform((v) => v || null),
  // Data e hora local, como o campo datetime-local envia (AAAA-MM-DDTHH:MM).
  scheduledAt: z.string().regex(LOCAL_DATETIME, "Informe a data e a hora"),
  /** Chamado a vincular (opcional). */
  ticketId: id.nullable().default(null),
});

export const agendaQuerySchema = z.object({
  when: z.enum(["upcoming", "past"]).optional(),
  ticketId: id.optional(),
});


export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const idParamSchema = z.object({ id });

export type TicketQuery = z.infer<typeof ticketQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
