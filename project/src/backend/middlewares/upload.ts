import { basename, extname } from "node:path";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES + 64 * 1024;

/** Tipos aceitos como anexo (o arquivo é sempre baixado, nunca exibido pelo servidor). */
export const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".txt", ".log", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".odt", ".ods",
  ".zip",
]);

export interface UploadedFile {
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array;
}

const tooLarge = () =>
  new HttpError(413, "PAYLOAD_TOO_LARGE", `Os anexos excedem o limite de ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB cada`);

const invalid = (message: string) =>
  new HttpError(400, "VALIDATION_ERROR", message, [{ field: "attachments", message }]);

async function readBody(req: Request): Promise<Uint8Array> {
  if (Number(req.headers["content-length"] ?? 0) > MAX_BODY_BYTES) throw tooLarge();
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw tooLarge();
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function cleanName(name: string): string {
  const safe = basename(name.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (safe || "arquivo").slice(0, 255);
}

/**
 * Lê requisições multipart/form-data: os campos de texto vão para req.body e
 * os arquivos do campo "attachments" para res.locals.files. Outros tipos de
 * corpo (JSON) passam direto.
 */
export async function parseMultipart(req: Request, res: Response, next: NextFunction) {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) return next();

  const body = await readBody(req);
  let form: FormData;
  try {
    // O parser de multipart nativo do Node (fetch/undici) evita uma dependência extra.
    const parser = new globalThis.Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    form = await parser.formData();
  } catch {
    throw new HttpError(400, "INVALID_MULTIPART", "O formulário enviado não é válido");
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of form) {
    if (typeof value === "string") fields[key] = value;
  }

  const uploaded: UploadedFile[] = [];
  for (const file of form.getAll("attachments")) {
    if (typeof file === "string" || file.name === "") continue;
    if (uploaded.length === MAX_ATTACHMENTS) throw invalid(`Envie no máximo ${MAX_ATTACHMENTS} anexos`);
    const originalName = cleanName(file.name);
    const extension = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) throw invalid(`Tipo de arquivo não permitido: ${originalName}`);
    if (file.size === 0) throw invalid(`O arquivo ${originalName} está vazio`);
    if (file.size > MAX_ATTACHMENT_BYTES) throw tooLarge();
    uploaded.push({
      originalName,
      extension,
      mimeType: (file.type || "application/octet-stream").slice(0, 120),
      sizeBytes: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
    });
  }

  req.body = fields;
  res.locals.files = uploaded;
  next();
}
