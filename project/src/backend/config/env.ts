import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().regex(/^\w+$/, "DB_NAME aceita apenas letras, números e _").default("deskhelp"),
  DB_USER: z.string().regex(/^\w+$/, "DB_USER aceita apenas letras, números e _").default("deskhelp"),
  DB_PASSWORD: z.string().min(1, "Defina DB_PASSWORD no .env"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  ALLOW_SIGNUP: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  ADMIN_NAME: z.string().default("Administrador"),
  ADMIN_EMAIL: z.string().default("admin@deskhelp.local"),
  ADMIN_PASSWORD: z.string().optional(),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuração inválida no .env:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
