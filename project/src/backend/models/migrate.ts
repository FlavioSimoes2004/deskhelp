/**
 * Cria as tabelas (schema.sql) e o administrador inicial definido no .env.
 * Uso: npm run db:migrate
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/password.js";
import { upgradeComments } from "./upgradeComments.js";
import { upgradeTickets } from "./upgradeTickets.js";

const schemaSql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  multipleStatements: true,
});

try {
  await conn.query(schemaSql);
  await upgradeComments(conn);
  await upgradeTickets(conn);
  console.log("Tabelas criadas/atualizadas.");

  const [admins] = await conn.query<mysql.RowDataPacket[]>("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (admins.length > 0) {
    console.log("Já existe um administrador; nenhum usuário criado.");
  } else if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) {
    console.warn("Nenhum administrador criado: defina ADMIN_PASSWORD (mín. 8 caracteres) no .env.");
  } else {
    await conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')", [
      env.ADMIN_NAME,
      env.ADMIN_EMAIL.trim().toLowerCase(),
      await hashPassword(env.ADMIN_PASSWORD),
    ]);
    console.log(`Administrador criado: ${env.ADMIN_EMAIL} (senha em ADMIN_PASSWORD no .env).`);
  }
} finally {
  await conn.end();
}
