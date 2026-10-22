import { describe, expect, it } from "vitest";
import {
  applySupportRules,
  assertCanAddComment,
  assertCanRate,
  assertCanSetSolution,
  assertMachineWhenResolved,
  canComment,
  canViewTicket,
  diffTicket,
  statusTimestamps,
} from "./ticketRules.js";

const admin = { id: 1, role: "admin" as const };
const comum = { id: 2, role: "comum" as const };
const support = { id: 7, role: "support" as const };
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

  it("allows support to view any ticket", () => {
    expect(canViewTicket(support, { requesterId: 99 })).toBe(true);
  });
});

describe("canComment", () => {
  it("allows the requester and the assignee", () => {
    expect(canComment(comum, { requesterId: 2, assigneeId: 7 })).toBe(true);
    expect(canComment(support, { requesterId: 2, assigneeId: 7 })).toBe(true);
  });

  it("denies anyone else, including admins", () => {
    expect(canComment(admin, { requesterId: 2, assigneeId: 7 })).toBe(false);
    expect(canComment(support, { requesterId: 2, assigneeId: null })).toBe(false);
  });
});

describe("applySupportRules", () => {
  const open = { status: "aberto" as const, assigneeId: null };

  it("lets support assume an unassigned ticket and moves it to in progress", () => {
    expect(applySupportRules(support, open, { assigneeId: 7 })).toEqual({ assigneeId: 7, status: "em_andamento" });
  });

  it("keeps the status when the assumed ticket is not open", () => {
    expect(applySupportRules(support, { status: "aguardando", assigneeId: null }, { assigneeId: 7 })).toEqual({
      assigneeId: 7,
    });
  });

  it("denies assigning the ticket to someone else", () => {
    expect(() => applySupportRules(support, open, { assigneeId: 8 })).toThrow(/para si/);
  });

  it("denies changing an existing assignee", () => {
    const assigned = { status: "em_andamento" as const, assigneeId: 8 };
    expect(() => applySupportRules(support, assigned, { assigneeId: 7 })).toThrow(/já tem um responsável/);
    expect(() => applySupportRules(support, assigned, { assigneeId: null })).toThrow(/já tem um responsável/);
  });

  it("denies changing the status, title or description", () => {
    expect(() => applySupportRules(support, open, { status: "resolvido" })).toThrow(/status/);
    expect(() => applySupportRules(support, open, { title: "Novo assunto" })).toThrow(/assunto/);
  });

  it("allows priority and category, ignoring an unchanged assignee", () => {
    const assigned = { status: "em_andamento" as const, assigneeId: 8 };
    expect(applySupportRules(support, assigned, { priority: "alta", categoryId: 3, assigneeId: 8 })).toEqual({
      priority: "alta",
      categoryId: 3,
    });
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

const baseTicket = {
  title: "Impressora sem toner",
  description: "A impressora do 2º andar parou.",
  status: "aberto" as const,
  priority: "media" as const,
  categoryId: 1,
  assigneeId: null,
  machineId: null,
  solution: null,
};

describe("diffTicket", () => {
  const current = {
    title: "Impressora sem toner",
    description: "A impressora do 2º andar parou.",
    status: "aberto" as const,
    priority: "media" as const,
    categoryId: 1,
    assigneeId: null,
    machineId: null,
    solution: null,
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

describe("assertMachineWhenResolved", () => {
  it("requires a machine to resolve a ticket", () => {
    expect(() => assertMachineWhenResolved({ status: "em_andamento", machineId: null }, { status: "resolvido" })).toThrow(
      /máquina/,
    );
  });

  it("allows resolving when the ticket has, or gets, a machine", () => {
    expect(() => assertMachineWhenResolved({ status: "em_andamento", machineId: 3 }, { status: "resolvido" })).not.toThrow();
    expect(() =>
      assertMachineWhenResolved({ status: "em_andamento", machineId: null }, { status: "resolvido", machineId: 3 }),
    ).not.toThrow();
  });

  it("blocks removing the machine from a resolved ticket", () => {
    expect(() => assertMachineWhenResolved({ status: "resolvido", machineId: 3 }, { machineId: null })).toThrow(/máquina/);
  });

  it("does not block unrelated edits on an old resolved ticket without machine", () => {
    expect(() => assertMachineWhenResolved({ status: "resolvido", machineId: null }, { status: "resolvido" })).not.toThrow();
    expect(() => assertMachineWhenResolved({ status: "resolvido", machineId: null }, {})).not.toThrow();
  });

  it("does not require a machine for other statuses", () => {
    expect(() => assertMachineWhenResolved({ status: "aberto", machineId: null }, { status: "fechado" })).not.toThrow();
  });
});

describe("applySupportRules and machines", () => {
  it("lets support link a machine", () => {
    expect(applySupportRules(support, { status: "em_andamento", assigneeId: 7 }, { machineId: 3 })).toEqual({ machineId: 3 });
  });
});

describe("assertCanSetSolution", () => {
  const resolved = { status: "resolvido" as const, assigneeId: 7 };

  it("lets the assignee and admins record the solution of a resolved ticket", () => {
    expect(() => assertCanSetSolution(support, resolved)).not.toThrow();
    expect(() => assertCanSetSolution(admin, resolved)).not.toThrow();
    expect(() => assertCanSetSolution(admin, { ...resolved, assigneeId: null })).not.toThrow();
  });

  it("denies anyone else, including the requester", () => {
    expect(() => assertCanSetSolution(comum, resolved)).toThrow(/responsável/);
    expect(() => assertCanSetSolution({ id: 8, role: "support" }, resolved)).toThrow(/responsável/);
  });

  it("requires the ticket to be resolved", () => {
    expect(() => assertCanSetSolution(support, { ...resolved, status: "em_andamento" })).toThrow(/resolvido/);
    expect(() => assertCanSetSolution(admin, { ...resolved, status: "fechado" })).toThrow(/resolvido/);
  });

  it("records the solution in the history", () => {
    expect(diffTicket({ ...baseTicket, solution: null }, { solution: "Troquei o toner" })).toEqual([
      { field: "solution", oldValue: null, newValue: "Troquei o toner" },
    ]);
  });
});

describe("assertCanAddComment", () => {
  const ticket = { requesterId: 2, assigneeId: 7, status: "em_andamento" as const };

  it("keeps normal comments for the requester and the assignee", () => {
    expect(() => assertCanAddComment(comum, ticket, false)).not.toThrow();
    expect(() => assertCanAddComment(support, ticket, false)).not.toThrow();
    expect(() => assertCanAddComment(admin, ticket, false)).toThrow(/responsável/);
  });

  it("lets any staff member write internal notes, but not common users", () => {
    expect(() => assertCanAddComment(admin, ticket, true)).not.toThrow();
    expect(() => assertCanAddComment({ id: 9, role: "support" }, ticket, true)).not.toThrow();
    expect(() => assertCanAddComment(comum, ticket, true)).toThrow(/notas internas/);
  });

  it("only admins comment on closed tickets", () => {
    expect(() => assertCanAddComment(support, { ...ticket, status: "fechado" }, true)).toThrow(/fechado/);
    expect(() => assertCanAddComment(admin, { ...ticket, status: "fechado" }, true)).not.toThrow();
  });
});

describe("assertCanRate", () => {
  const resolved = { requesterId: 2, status: "resolvido" as const, rating: null };

  it("lets the requester rate a resolved or closed ticket", () => {
    expect(() => assertCanRate(comum, resolved)).not.toThrow();
    expect(() => assertCanRate(comum, { ...resolved, status: "fechado" })).not.toThrow();
  });

  it("denies other users, open tickets and a second rating", () => {
    expect(() => assertCanRate(admin, resolved)).toThrow(/Somente quem abriu/);
    expect(() => assertCanRate(comum, { ...resolved, status: "em_andamento" })).toThrow(/resolvido/);
    expect(() => assertCanRate(comum, { ...resolved, rating: 4 })).toThrow(/já foi avaliado/);
  });
});
