import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authCtrl from "../controllers/authController.js";
import * as docsCtrl from "../controllers/docsController.js";
import * as machineCtrl from "../controllers/machineController.js";
import * as reportCtrl from "../controllers/reportController.js";
import * as ticketCtrl from "../controllers/ticketController.js";
import * as userCtrl from "../controllers/userController.js";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  commentSchema,
  createMachineSchema,
  createTicketSchema,
  createUserSchema,
  idParamSchema,
  loginSchema,
  machineQuerySchema,
  registerSchema,
  reportQuerySchema,
  ticketQuerySchema,
  updateMachineSchema,
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
const adminOnly = requireRole("admin");
const staffOnly = requireRole("admin", "support");

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

apiRouter.get("/categories", ticketCtrl.categories);
apiRouter.get("/tickets/overview", ticketCtrl.overview);
apiRouter.get("/tickets", validate(ticketQuerySchema, "query"), ticketCtrl.list);
apiRouter.post("/tickets", validate(createTicketSchema), ticketCtrl.create);
apiRouter.get("/tickets/:id", byId, ticketCtrl.get);
apiRouter.post("/tickets/:id/comments", byId, parseMultipart, validate(commentSchema), ticketCtrl.addComment);
apiRouter.post("/tickets/:id/resolve", requireRole("comum"), byId, ticketCtrl.resolve);
apiRouter.get("/attachments/:id", byId, ticketCtrl.downloadAttachment);

// Administradores e suporte (o suporte tem regras próprias no ticketService)
apiRouter.patch("/tickets/:id", staffOnly, byId, validate(updateTicketSchema), ticketCtrl.update);
apiRouter.get("/users/staff", staffOnly, userCtrl.staff);

// Usuários e máquinas: administradores e suporte (o suporte não gerencia administradores)
apiRouter.get("/users", staffOnly, validate(userQuerySchema, "query"), userCtrl.list);
apiRouter.post("/users", staffOnly, validate(createUserSchema), userCtrl.create);
apiRouter.get("/users/:id", staffOnly, byId, userCtrl.get);
apiRouter.patch("/users/:id", staffOnly, byId, validate(updateUserSchema), userCtrl.update);

apiRouter.get("/machines", staffOnly, validate(machineQuerySchema, "query"), machineCtrl.list);
apiRouter.post("/machines", staffOnly, validate(createMachineSchema), machineCtrl.create);
apiRouter.get("/machines/:id", staffOnly, byId, machineCtrl.get);
apiRouter.patch("/machines/:id", staffOnly, byId, validate(updateMachineSchema), machineCtrl.update);
apiRouter.get("/machines/:id/history", staffOnly, byId, machineCtrl.history);

// Somente administradores
apiRouter.get("/reports/summary", adminOnly, validate(reportQuerySchema, "query"), reportCtrl.summary);
apiRouter.get("/reports/tickets.csv", adminOnly, validate(reportQuerySchema, "query"), reportCtrl.exportCsv);
