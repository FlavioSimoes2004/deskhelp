import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "NOT_FOUND", "Rota não encontrada"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // JSON malformado no corpo da requisição.
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "O corpo da requisição não é um JSON válido" } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erro interno no servidor" } });
}
