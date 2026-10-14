import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authCtrl from "../controllers/authController.js";
import * as docsCtrl from "../controllers/docsController.js";
import * as reportCtrl from "../controllers/reportController.js";
import * as ticketCtrl from "../controllers/ticketController.js";
import * as userCtrl from "../controllers/userController.js";
import { authenticate, requireRole } from "../middlewares/auth.js";
import {
  commentSchema,
  createTicketSchema,
  createUserSchema,
  idParamSchema,
  loginSchema,
  registerSchema,
  reportQuerySchema,
  ticketQuerySchema,
  updateProfileSchema,
  updateTicketSchema,
  updateUserSchema,
  userQuerySchema,
} from "../middlewares/schemas.js";
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
apiRouter.post("/tickets/:id/comments", byId, validate(commentSchema), ticketCtrl.addComment);

// Somente administradores
apiRouter.patch("/tickets/:id", adminOnly, byId, validate(updateTicketSchema), ticketCtrl.update);
apiRouter.delete("/tickets/:id", adminOnly, byId, ticketCtrl.remove);

apiRouter.get("/users", adminOnly, validate(userQuerySchema, "query"), userCtrl.list);
apiRouter.post("/users", adminOnly, validate(createUserSchema), userCtrl.create);
apiRouter.get("/users/:id", adminOnly, byId, userCtrl.get);
apiRouter.patch("/users/:id", adminOnly, byId, validate(updateUserSchema), userCtrl.update);

apiRouter.get("/reports/summary", adminOnly, validate(reportQuerySchema, "query"), reportCtrl.summary);
apiRouter.get("/reports/tickets.csv", adminOnly, validate(reportQuerySchema, "query"), reportCtrl.exportCsv);
