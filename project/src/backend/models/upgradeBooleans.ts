/**
 * Garante que as colunas booleanas (TINYINT(1)) só aceitem 0 ou 1: CHECK (coluna IN (0, 1)).
 * Bancos novos já recebem a regra pelo schema.sql; nos anteriores, valores fora disso viram 1
 * (qualquer valor diferente de 0 era tratado como verdadeiro) e a regra é criada.
 * Chamado por migrate.ts; não faz nada se a regra já existir.
 */
import type mysql from "mysql2/promise";

/** Toda coluna booleana nova precisa entrar nesta lista (e ter o CHECK no schema.sql). */
const BOOLEAN_COLUMNS = [
  { table: "users", column: "active", constraint: "chk_users_active" },
  { table: "categories", column: "active", constraint: "chk_categories_active" },
  { table: "ticket_comments", column: "is_internal", constraint: "chk_comments_is_internal" },
] as const;

async function checkExists(conn: mysql.Connection, table: string, name: string): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND table_name = ? AND constraint_name = ? AND constraint_type = 'CHECK'`,
    [table, name],
  );
  return rows.length > 0;
}

export async function upgradeBooleans(conn: mysql.Connection): Promise<void> {
  for (const { table, column, constraint } of BOOLEAN_COLUMNS) {
    if (await checkExists(conn, table, constraint)) continue;
    // Sem isso, o ALTER falharia se alguma linha tivesse outro valor.
    const [fixed] = await conn.query<mysql.ResultSetHeader>(
      `UPDATE ${table} SET ${column} = 1 WHERE ${column} NOT IN (0, 1)`,
    );
    if (fixed.affectedRows > 0) {
      console.warn(`${table}.${column}: ${fixed.affectedRows} linha(s) com valor diferente de 0/1 passaram a 1.`);
    }
    await conn.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (${column} IN (0, 1))`);
    console.log(`Regra ${constraint} criada: ${table}.${column} aceita só 0 ou 1.`);
  }
}
