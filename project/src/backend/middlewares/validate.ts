import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { HttpError } from "../utils/httpError.js";

type Source = "body" | "query" | "params";

/**
 * Valida req[source] com o schema zod. O resultado convertido fica em
 * res.locals[source] (req.query é somente leitura no Express 5).
 */
export const validate =
  (schema: z.ZodType, source: Source = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));
      return next(new HttpError(400, "VALIDATION_ERROR", details[0]?.message ?? "Dados inválidos", details));
    }
    res.locals[source] = result.data;
    next();
  };
