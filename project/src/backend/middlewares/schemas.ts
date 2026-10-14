import { z } from "zod";
import { ROLES, TICKET_PRIORITIES, TICKET_STATUSES } from "../models/types.js";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido").max(190));
const password = z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(128);
const name = z.string().trim().min(2, "Informe o nome").max(120);
const id = z.coerce.number().int().positive();

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
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Nenhum campo para atualizar" });

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva o comentário").max(5000),
});

export const ticketQuerySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  categoryId: id.optional(),
  assigneeId: id.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((n) => Math.min(n, 100)),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

export const reportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const idParamSchema = z.object({ id });

export type TicketQuery = z.infer<typeof ticketQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
