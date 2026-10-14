import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Request, Response } from "express";
import { parse } from "yaml";

// Lido a partir da raiz do projeto para funcionar tanto com tsx quanto com o build em dist/.
const specPath = resolve(process.cwd(), "src/docs/openapi.yaml");
let cached: unknown;

export async function openapi(_req: Request, res: Response) {
  cached ??= parse(await readFile(specPath, "utf8"));
  res.json(cached);
}
