/**
 * Cria as tabelas (schema.sql) e o administrador inicial definido no .env.
 * Uso: npm run db:migrate
 */
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/password.js";
import { upgradeComments } from "./upgradeComments.js";
import { upgradeNotifications } from "./upgradeNotifications.js";
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
  // Antes do perfil super_support, "admin" tinha acesso total. Na primeira migração com o
  // perfil novo, essas contas viram super_support para ninguém perder o acesso que já tinha.
  const [roleColumn] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT column_type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'`,
  );
  const convertAdmins = roleColumn.length > 0 && !String(roleColumn[0]!.column_type).includes("super_support");

  await conn.query(schemaSql);
  if (convertAdmins) {
    const [result] = await conn.query<mysql.ResultSetHeader>(
      "UPDATE users SET role = 'super_support' WHERE role = 'admin'",
    );
    console.log(`Perfil super support criado: ${result.affectedRows} conta(s) admin convertida(s) para super support.`);
  }
  await upgradeComments(conn);
  await upgradeTickets(conn);
  await upgradeNotifications(conn);
  console.log("Tabelas criadas/atualizadas.");

  // Conta inicial: super support (o perfil com acesso total).
  const [admins] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT id FROM users WHERE role = 'super_support' LIMIT 1",
  );
  if (admins.length > 0) {
    console.log("Já existe um super support; nenhum usuário criado.");
  } else if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) {
    console.warn("Nenhuma conta inicial criada: defina ADMIN_PASSWORD (mín. 8 caracteres) no .env.");
  } else {
    await conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'super_support')", [
      env.ADMIN_NAME,
      env.ADMIN_EMAIL.trim().toLowerCase(),
      await hashPassword(env.ADMIN_PASSWORD),
    ]);
    console.log(`Super support criado: ${env.ADMIN_EMAIL} (senha em ADMIN_PASSWORD no .env).`);
  }
} finally {
  await conn.end();
}
