import mysql from "mysql2/promise";
import type { QueryValues } from "mysql2";
import { env } from "./env.js";

/** Pool de conexões com o MariaDB (o driver mysql2 é compatível). */
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionLimit: 10,
  // O MariaDB grava CURRENT_TIMESTAMP no fuso do sistema; o driver lê no mesmo fuso
  // (API e banco na mesma máquina), assim relatórios "por dia" usam o dia local.
  timezone: "local",
  namedPlaceholders: true,
});

/** Parâmetros nomeados aceitos pelas consultas (:nome no SQL). */
export type SqlParams = { [key: string]: QueryValues };
