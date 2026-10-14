/**
 * Cria o banco e o usuário do DeskHelp (dados do .env) usando uma conta
 * administrativa do MariaDB. A senha é pedida no terminal, sem eco.
 *
 * Uso: npm run db:setup
 *      DB_ROOT_USER=outro_admin npm run db:setup
 */
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("Execute em um terminal interativo para digitar a senha."));
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const rootUser = process.env.DB_ROOT_USER ?? "root";
const rootPassword = await askHidden(`Senha do usuário "${rootUser}" do MariaDB (vazio se não houver): `);

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: rootUser,
  password: rootPassword,
});

// Conexões a "localhost" via TCP chegam como 'localhost' no MariaDB padrão do Fedora.
const host = env.DB_HOST === "127.0.0.1" ? "127.0.0.1" : "localhost";
const user = `${conn.escape(env.DB_USER)}@${conn.escape(host)}`;
const password = conn.escape(env.DB_PASSWORD);

try {
  // DB_NAME e DB_USER são validados em config/env.ts (somente letras, números e _).
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.query(`CREATE USER IF NOT EXISTS ${user} IDENTIFIED BY ${password}`);
  await conn.query(`ALTER USER ${user} IDENTIFIED BY ${password}`);
  await conn.query(`GRANT ALL PRIVILEGES ON \`${env.DB_NAME}\`.* TO ${user}`);
  console.log(`Banco "${env.DB_NAME}" e usuário "${env.DB_USER}" prontos. Agora rode: npm run db:migrate`);
} finally {
  await conn.end();
}
