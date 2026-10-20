/**
 * Cria a chave estrangeira de notifications.agenda_id (-> agenda_items) em bancos
 * criados antes da agenda. Chamado por migrate.ts; não faz nada se já existir.
 */
import type mysql from "mysql2/promise";
import { foreignKeyExists } from "./upgradeComments.js";

export async function upgradeNotifications(conn: mysql.Connection): Promise<void> {
  if (!(await foreignKeyExists(conn, "notifications", "fk_notifications_agenda"))) {
    await conn.query(
      `ALTER TABLE notifications ADD CONSTRAINT fk_notifications_agenda
       FOREIGN KEY (agenda_id) REFERENCES agenda_items (id) ON DELETE CASCADE`,
    );
  }
}
