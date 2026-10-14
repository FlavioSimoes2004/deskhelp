import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { env } from "../config/env.js";
import { notFound } from "./httpError.js";

const root = () => resolve(process.cwd(), env.UPLOAD_DIR);

/**
 * Converte um caminho relativo (como gravado no banco) em absoluto,
 * recusando qualquer caminho que saia da pasta de uploads.
 */
export function resolveStored(relativePath: string): string {
  const base = root();
  const full = resolve(base, relativePath);
  const rel = relative(base, full);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw notFound("Arquivo não encontrado");
  return full;
}

/** Grava o arquivo com nome aleatório em <UPLOAD_DIR>/<folder> e devolve o caminho relativo. */
export async function saveFile(folder: string, extension: string, data: Uint8Array): Promise<string> {
  const relativePath = `${folder}/${randomUUID()}${extension}`;
  const full = resolveStored(relativePath);
  await mkdir(resolve(full, ".."), { recursive: true });
  await writeFile(full, data, { flag: "wx" });
  return relativePath;
}

/** Remove um arquivo ou pasta da área de uploads; ausência não é erro. */
export async function removeStored(relativePath: string): Promise<void> {
  await rm(resolveStored(relativePath), { recursive: true, force: true });
}
