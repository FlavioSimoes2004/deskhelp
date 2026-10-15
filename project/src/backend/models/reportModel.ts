import type { RowDataPacket } from "mysql2";
import { pool } from "../config/database.js";
import type { TicketStatus } from "./types.js";

export type Period = {
  from: string; // AAAA-MM-DD, inclusivo
  to: string; // AAAA-MM-DD, inclusivo
};

const PERIOD = "t.created_at >= :from AND t.created_at < DATE_ADD(:to, INTERVAL 1 DAY)";

async function grouped(labelSql: string, join: string, period: Period) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${labelSql} AS label, COUNT(*) AS total
     FROM tickets t ${join}
     WHERE ${PERIOD}
     GROUP BY label ORDER BY total DESC, label`,
    period,
  );
  return rows.map((r) => ({ label: r.label === null ? null : String(r.label), total: Number(r.total) }));
}

export const ticketsByStatus = (p: Period) => grouped("t.status", "", p);
export const ticketsByPriority = (p: Period) => grouped("t.priority", "", p);
export const ticketsByCategory = (p: Period) => grouped("c.name", "JOIN categories c ON c.id = t.category_id", p);
export const ticketsByAssignee = (p: Period) => grouped("a.name", "LEFT JOIN users a ON a.id = t.assignee_id", p);

export async function ticketsPerDay(period: Period) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(t.created_at, '%Y-%m-%d') AS day, COUNT(*) AS total
     FROM tickets t WHERE ${PERIOD}
     GROUP BY day ORDER BY day`,
    period,
  );
  return rows.map((r) => ({ day: String(r.day), total: Number(r.total) }));
}

export async function resolutionStats(period: Period) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(t.resolved_at IS NOT NULL) AS resolved,
            AVG(CASE WHEN t.resolved_at IS NOT NULL
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.resolved_at) END) AS avg_minutes
     FROM tickets t WHERE ${PERIOD}`,
    period,
  );
  const row = rows[0];
  return {
    total: Number(row?.total ?? 0),
    resolved: Number(row?.resolved ?? 0),
    avgResolutionHours: row?.avg_minutes == null ? null : Math.round((Number(row.avg_minutes) / 60) * 10) / 10,
  };
}

export async function ticketsForExport(period: Period) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.title, t.status, t.priority, c.name AS category, r.name AS requester,
            a.name AS assignee, t.created_at, t.resolved_at, t.closed_at
     FROM tickets t
     JOIN categories c ON c.id = t.category_id
     JOIN users r ON r.id = t.requester_id
     LEFT JOIN users a ON a.id = t.assignee_id
     WHERE ${PERIOD}
     ORDER BY t.created_at`,
    period,
  );
  return rows;
}

/** Chamados do período com máquina vinculada, agrupados por máquina, status e categoria. */
export async function ticketsByMachine(period: Period) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.id AS machine_id, m.mac_address, m.description, u.name AS user_name,
            t.status, c.name AS category, COUNT(*) AS total
     FROM tickets t
     JOIN machines m ON m.id = t.machine_id
     LEFT JOIN users u ON u.id = m.user_id
     JOIN categories c ON c.id = t.category_id
     WHERE ${PERIOD}
     GROUP BY m.id, t.status, c.id`,
    period,
  );
  return rows.map((r) => ({
    machineId: Number(r.machine_id),
    macAddress: String(r.mac_address),
    description: r.description === null ? null : String(r.description),
    userName: r.user_name === null ? null : String(r.user_name),
    status: r.status as TicketStatus,
    category: String(r.category),
    total: Number(r.total),
  }));
}

/** Chamados do período sem máquina vinculada. */
export async function ticketsWithoutMachine(period: Period): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM tickets t WHERE ${PERIOD} AND t.machine_id IS NULL`,
    period,
  );
  return Number(rows[0]?.total ?? 0);
}

/** Quem é agrupado no relatório de pessoas: quem abriu o chamado ou o responsável. */
export type PersonRole = "requester" | "assignee";

// Nomes de coluna fixos (nunca vêm do usuário).
const PERSON_COLUMN: Record<PersonRole, string> = { requester: "t.requester_id", assignee: "t.assignee_id" };

/** Chamados do período por pessoa, status e categoria (user_id NULL = sem responsável). */
export async function ticketsByPerson(period: Period, role: PersonRole) {
  const column = PERSON_COLUMN[role];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${column} AS user_id, u.name AS user_name, t.status, c.name AS category, COUNT(*) AS total
     FROM tickets t
     LEFT JOIN users u ON u.id = ${column}
     JOIN categories c ON c.id = t.category_id
     WHERE ${PERIOD}
     GROUP BY ${column}, t.status, c.id`,
    period,
  );
  return rows.map((r) => ({
    userId: r.user_id === null ? null : Number(r.user_id),
    userName: r.user_name === null ? null : String(r.user_name),
    status: r.status as TicketStatus,
    category: String(r.category),
    total: Number(r.total),
  }));
}

/** Resolvidos e tempo médio até resolver, por pessoa, no período. */
export async function resolutionByPerson(period: Period, role: PersonRole) {
  const column = PERSON_COLUMN[role];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${column} AS user_id,
            SUM(t.resolved_at IS NOT NULL) AS resolved,
            AVG(CASE WHEN t.resolved_at IS NOT NULL
                     THEN TIMESTAMPDIFF(MINUTE, t.created_at, t.resolved_at) END) AS avg_minutes
     FROM tickets t WHERE ${PERIOD}
     GROUP BY ${column}`,
    period,
  );
  return rows.map((r) => ({
    userId: r.user_id === null ? null : Number(r.user_id),
    resolved: Number(r.resolved ?? 0),
    avgMinutes: r.avg_minutes == null ? null : Number(r.avg_minutes),
  }));
}
