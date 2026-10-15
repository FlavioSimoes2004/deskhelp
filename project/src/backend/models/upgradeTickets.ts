/**
 * Cria o índice e a chave estrangeira de tickets.machine_id (-> machines), que não
 * podem ficar no CREATE TABLE de tickets porque machines é criada depois.
 * Chamado por migrate.ts depois do schema.sql; não faz nada se já existirem.
 */
import type mysql from "mysql2/promise";
import { foreignKeyExists, indexExists } from "./upgradeComments.js";

export async function upgradeTickets(conn: mysql.Connection): Promise<void> {
  if (!(await indexExists(conn, "tickets", "idx_tickets_machine"))) {
    await conn.query("ALTER TABLE tickets ADD KEY idx_tickets_machine (machine_id)");
  }
  if (!(await foreignKeyExists(conn, "tickets", "fk_tickets_machine"))) {
    await conn.query(
      `ALTER TABLE tickets ADD CONSTRAINT fk_tickets_machine
       FOREIGN KEY (machine_id) REFERENCES machines (id) ON DELETE SET NULL`,
    );
  }
}
