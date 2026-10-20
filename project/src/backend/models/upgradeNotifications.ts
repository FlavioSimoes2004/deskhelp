/**
 * Cria as chaves que faltam em bancos criados antes da agenda: notifications.agenda_id
 * (-> agenda_items) e agenda_items.ticket_id (-> tickets). Chamado por migrate.ts;
 * não faz nada se já existirem.
 */
import type mysql from "mysql2/promise";
import { foreignKeyExists, indexExists } from "./upgradeComments.js";

export async function upgradeNotifications(conn: mysql.Connection): Promise<void> {
  if (!(await foreignKeyExists(conn, "notifications", "fk_notifications_agenda"))) {
    await conn.query(
      `ALTER TABLE notifications ADD CONSTRAINT fk_notifications_agenda
       FOREIGN KEY (agenda_id) REFERENCES agenda_items (id) ON DELETE CASCADE`,
    );
  }
  if (!(await indexExists(conn, "agenda_items", "idx_agenda_ticket"))) {
    await conn.query("ALTER TABLE agenda_items ADD KEY idx_agenda_ticket (ticket_id)");
  }
  if (!(await foreignKeyExists(conn, "agenda_items", "fk_agenda_ticket"))) {
    await conn.query(
      `ALTER TABLE agenda_items ADD CONSTRAINT fk_agenda_ticket
       FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE SET NULL`,
    );
  }
}
