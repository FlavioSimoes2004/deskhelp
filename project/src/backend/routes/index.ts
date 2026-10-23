import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as agendaCtrl from "../controllers/agendaController.js";
import * as authCtrl from "../controllers/authController.js";
import * as categoryCtrl from "../controllers/categoryController.js";
import * as docsCtrl from "../controllers/docsController.js";
import * as machineCtrl from "../controllers/machineController.js";
import * as notificationCtrl from "../controllers/notificationController.js";
import * as reportCtrl from "../controllers/reportController.js";
import * as settingsCtrl from "../controllers/settingsController.js";
import * as ticketCtrl from "../controllers/ticketController.js";
import * as userCtrl from "../controllers/userController.js";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  agendaQuerySchema,
  commentSchema,
  createAgendaSchema,
  createCategorySchema,
  updateCategorySchema,
  updateAgendaSchema,
  createMachineSchema,
  createTicketSchema,
  createUserSchema,
  idParamSchema,
  loginSchema,
  machineQuerySchema,
  notificationQuerySchema,
  registerSchema,
  ratingSchema,
  reportQuerySchema,
  settingsSchema,
  solutionSchema,
  ticketQuerySchema,
  updateMachineSchema,
  updateNotificationSchema,
  updateProfileSchema,
  updateTicketSchema,
  updateUserSchema,
  userQuerySchema,
} from "../middlewares/schemas.js";
import { parseMultipart } from "../middlewares/upload.js";
import { validate } from "../middlewares/validate.js";

// Limita tentativas de login/cadastro por IP para dificultar força bruta.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Tente novamente em alguns minutos." } },
});

const byId = validate(idParamSchema, "params");
// Perfis: super_support (tudo), support (atendimento), admin (como comum + Administração), comum.
const superOnly = requireRole("super_support");
const staffOnly = requireRole("support", "super_support");
const administration = requireRole("admin", "super_support");

export const apiRouter = Router();

// Público
apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
apiRouter.get("/openapi.json", docsCtrl.openapi);
apiRouter.get("/auth/config", authCtrl.config);
apiRouter.post("/auth/login", authLimiter, validate(loginSchema), authCtrl.login);
apiRouter.post("/auth/register", authLimiter, validate(registerSchema), authCtrl.register);

// Autenticado (qualquer perfil)
apiRouter.use(authenticate);
apiRouter.get("/auth/me", authCtrl.me);
apiRouter.patch("/auth/me", validate(updateProfileSchema), authCtrl.updateMe);
apiRouter.post("/auth/logout", authCtrl.logout);

apiRouter.get("/categories", categoryCtrl.list);
// Configurações: todos leem (as telas se ajustam a elas); só admin altera.
apiRouter.get("/settings", settingsCtrl.get);
apiRouter.get("/tickets/overview", ticketCtrl.overview);
apiRouter.get("/tickets/oldest-open", ticketCtrl.oldestOpen);
apiRouter.get("/tickets", validate(ticketQuerySchema, "query"), ticketCtrl.list);
apiRouter.post("/tickets", validate(createTicketSchema), ticketCtrl.create);
apiRouter.get("/tickets/:id", byId, ticketCtrl.get);
apiRouter.post("/tickets/:id/comments", byId, parseMultipart, validate(commentSchema), ticketCtrl.addComment);
apiRouter.post("/tickets/:id/resolve", requireRole("comum", "admin"), byId, ticketCtrl.resolve);
// Solução: responsável ou admin, com o chamado resolvido (regras no ticketService)
apiRouter.put("/tickets/:id/solution", byId, validate(solutionSchema), ticketCtrl.setSolution);
// Avaliação do atendimento: quem abriu, com o chamado resolvido ou fechado (regras no ticketService)
apiRouter.post("/tickets/:id/rating", byId, validate(ratingSchema), ticketCtrl.rate);
apiRouter.get("/attachments/:id", byId, ticketCtrl.downloadAttachment);

// Agenda: cada usuário só vê e altera os próprios itens
apiRouter.get("/agenda", validate(agendaQuerySchema, "query"), agendaCtrl.list);
apiRouter.post("/agenda", validate(createAgendaSchema), agendaCtrl.create);
apiRouter.get("/agenda/due", agendaCtrl.due);
apiRouter.post("/agenda/:id/dismiss", byId, agendaCtrl.dismiss);
apiRouter.patch("/agenda/:id", byId, validate(updateAgendaSchema), agendaCtrl.update);
apiRouter.delete("/agenda/:id", byId, agendaCtrl.remove);

// Notificações: cada usuário só vê e altera as próprias
apiRouter.get("/notifications", validate(notificationQuerySchema, "query"), notificationCtrl.list);
apiRouter.get("/notifications/unread-count", notificationCtrl.unreadCount);
apiRouter.post("/notifications/read-all", notificationCtrl.readAll);
apiRouter.patch("/notifications/:id", byId, validate(updateNotificationSchema), notificationCtrl.update);

// Suporte e super suporte (o suporte tem regras próprias no ticketService)
apiRouter.patch("/tickets/:id", staffOnly, byId, validate(updateTicketSchema), ticketCtrl.update);
apiRouter.get("/users/staff", staffOnly, userCtrl.staff);

// Usuários e máquinas: suporte e super suporte (o suporte não gerencia admins nem super suportes)
apiRouter.get("/users", staffOnly, validate(userQuerySchema, "query"), userCtrl.list);
apiRouter.post("/users", staffOnly, validate(createUserSchema), userCtrl.create);
apiRouter.get("/users/:id", staffOnly, byId, userCtrl.get);
apiRouter.patch("/users/:id", staffOnly, byId, validate(updateUserSchema), userCtrl.update);

apiRouter.get("/machines", staffOnly, validate(machineQuerySchema, "query"), machineCtrl.list);
apiRouter.post("/machines", staffOnly, validate(createMachineSchema), machineCtrl.create);
apiRouter.get("/machines/:id", staffOnly, byId, machineCtrl.get);
apiRouter.patch("/machines/:id", staffOnly, byId, validate(updateMachineSchema), machineCtrl.update);
apiRouter.get("/machines/:id/history", staffOnly, byId, machineCtrl.history);

// Administração (admin e super suporte) e Super support (categorias)
apiRouter.put("/settings", administration, validate(settingsSchema), settingsCtrl.update);
apiRouter.post("/categories", superOnly, validate(createCategorySchema), categoryCtrl.create);
apiRouter.patch("/categories/:id", superOnly, byId, validate(updateCategorySchema), categoryCtrl.update);
apiRouter.get("/reports/summary", administration, validate(reportQuerySchema, "query"), reportCtrl.summary);
apiRouter.get("/reports/machines", administration, validate(reportQuerySchema, "query"), reportCtrl.machines);
apiRouter.get("/reports/requesters", administration, validate(reportQuerySchema, "query"), reportCtrl.requesters);
apiRouter.get("/reports/assignees", administration, validate(reportQuerySchema, "query"), reportCtrl.assignees);
apiRouter.get("/reports/machines.csv", administration, validate(reportQuerySchema, "query"), reportCtrl.machinesCsv);
apiRouter.get("/reports/requesters.csv", administration, validate(reportQuerySchema, "query"), reportCtrl.requestersCsv);
apiRouter.get("/reports/assignees.csv", administration, validate(reportQuerySchema, "query"), reportCtrl.assigneesCsv);
apiRouter.get("/reports/tickets.csv", administration, validate(reportQuerySchema, "query"), reportCtrl.exportCsv);
