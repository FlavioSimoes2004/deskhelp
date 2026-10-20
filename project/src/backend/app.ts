import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // A página de documentação (Swagger UI) usa estilos inline e imagens data:.
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          // blob: para pré-visualizar imagens anexadas (baixadas com o token e exibidas da memória).
          "img-src": ["'self'", "data:", "blob:"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", apiRouter);
  app.use("/api", notFoundHandler);

  // Em produção o próprio Express serve o frontend compilado pelo Vite.
  const clientDir = resolve(process.cwd(), "dist/client");
  if (env.NODE_ENV === "production" && existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get("/{*path}", (_req, res) => res.sendFile(resolve(clientDir, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
