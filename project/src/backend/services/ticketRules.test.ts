import { describe, expect, it } from "vitest";
import { canViewTicket, diffTicket, statusTimestamps } from "./ticketRules.js";

const admin = { id: 1, role: "admin" as const };
const comum = { id: 2, role: "comum" as const };
const now = new Date("2026-10-13T12:00:00Z");
const earlier = new Date("2026-10-10T09:00:00Z");

describe("canViewTicket", () => {
  it("allows an admin to view any ticket", () => {
    expect(canViewTicket(admin, { requesterId: 99 })).toBe(true);
  });

  it("allows a common user to view their own ticket", () => {
    expect(canViewTicket(comum, { requesterId: 2 })).toBe(true);
  });

  it("denies a common user access to someone else's ticket", () => {
    expect(canViewTicket(comum, { requesterId: 3 })).toBe(false);
  });
});

describe("statusTimestamps", () => {
  it("sets resolvedAt when a ticket becomes resolved", () => {
    const result = statusTimestamps({ status: "em_andamento", resolvedAt: null }, "resolvido", now);
    expect(result).toEqual({ resolvedAt: now, closedAt: null });
  });

  it("keeps the original resolvedAt when a resolved ticket is closed", () => {
    const result = statusTimestamps({ status: "resolvido", resolvedAt: earlier }, "fechado", now);
    expect(result).toEqual({ resolvedAt: earlier, closedAt: now });
  });

  it("fills resolvedAt when a ticket is closed without being resolved first", () => {
    const result = statusTimestamps({ status: "aberto", resolvedAt: null }, "fechado", now);
    expect(result).toEqual({ resolvedAt: now, closedAt: now });
  });

  it("clears both timestamps when a resolved ticket is reopened", () => {
    const result = statusTimestamps({ status: "resolvido", resolvedAt: earlier }, "aberto", now);
    expect(result).toEqual({ resolvedAt: null, closedAt: null });
  });
});

describe("diffTicket", () => {
  const current = {
    title: "Impressora sem toner",
    description: "A impressora do 2º andar parou.",
    status: "aberto" as const,
    priority: "media" as const,
    categoryId: 1,
    assigneeId: null,
  };

  it("returns only the fields whose value actually changes", () => {
    const changes = diffTicket(current, { status: "em_andamento", priority: "media", assigneeId: 5 });
    expect(changes).toEqual([
      { field: "status", oldValue: "aberto", newValue: "em_andamento" },
      { field: "assigneeId", oldValue: null, newValue: "5" },
    ]);
  });

  it("returns an empty list when nothing changes", () => {
    expect(diffTicket(current, { title: "Impressora sem toner" })).toEqual([]);
  });

  it("records unassigning a ticket as a change to null", () => {
    const changes = diffTicket({ ...current, assigneeId: 5 }, { assigneeId: null });
    expect(changes).toEqual([{ field: "assigneeId", oldValue: "5", newValue: null }]);
  });
});
