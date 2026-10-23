import { describe, expect, it } from "vitest";
import {
  applySupportRules,
  assertCanAddComment,
  assertCanConfirmSolution,
  assertCanRate,
  assertCanReopen,
  assertCanSetSolution,
  assertMachineWhenResolved,
  canComment,
  canViewTicket,
  diffTicket,
  reopenDeadline,
  statusTimestamps,
} from "./ticketRules.js";

const superSupport = { id: 1, role: "super_support" as const };
const comum = { id: 2, role: "comum" as const };
const support = { id: 7, role: "support" as const };
const now = new Date("2026-10-13T12:00:00Z");
const earlier = new Date("2026-10-10T09:00:00Z");

describe("canViewTicket", () => {
  it("allows an superSupport to view any ticket", () => {
    expect(canViewTicket(superSupport, { requesterId: 99 })).toBe(true);
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

  it("denies anyone else, including super support", () => {
    expect(canComment(superSupport, { requesterId: 2, assigneeId: 7 })).toBe(false);
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
  const ticket = { assigneeId: 7, machineId: 3 };

  it("lets the assignee and super support record the solution in any status", () => {
    expect(() => assertCanSetSolution(support, ticket, "Troquei o cabo")).not.toThrow();
    expect(() => assertCanSetSolution(superSupport, { ...ticket, assigneeId: null }, "Ok")).not.toThrow();
  });

  it("denies anyone else, including the requester", () => {
    expect(() => assertCanSetSolution(comum, ticket, "Ok")).toThrow(/responsável/);
    expect(() => assertCanSetSolution({ id: 8, role: "support" }, ticket, "Ok")).toThrow(/responsável/);
  });

  it("requires a linked machine (confirming makes the ticket resolved), except to remove it", () => {
    expect(() => assertCanSetSolution(support, { ...ticket, machineId: null }, "Ok")).toThrow(/máquina/);
    expect(() => assertCanSetSolution(support, { ...ticket, machineId: null }, null)).not.toThrow();
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
    expect(() => assertCanAddComment(superSupport, ticket, false)).toThrow(/responsável/);
  });

  it("lets any staff member write internal notes, but not common users", () => {
    expect(() => assertCanAddComment(superSupport, ticket, true)).not.toThrow();
    expect(() => assertCanAddComment({ id: 9, role: "support" }, ticket, true)).not.toThrow();
    expect(() => assertCanAddComment(comum, ticket, true)).toThrow(/notas internas/);
  });

  it("only super support comments on closed tickets", () => {
    expect(() => assertCanAddComment(support, { ...ticket, status: "fechado" }, true)).toThrow(/fechado/);
    expect(() => assertCanAddComment(superSupport, { ...ticket, status: "fechado" }, true)).not.toThrow();
  });
});

describe("assertCanRate", () => {
  const resolved = { requesterId: 2, status: "resolvido" as const, rating: null };

  it("lets the requester rate a resolved or closed ticket", () => {
    expect(() => assertCanRate(comum, resolved)).not.toThrow();
    expect(() => assertCanRate(comum, { ...resolved, status: "fechado" })).not.toThrow();
  });

  it("denies other users, open tickets and a second rating", () => {
    expect(() => assertCanRate(superSupport, resolved)).toThrow(/Somente quem abriu/);
    expect(() => assertCanRate(comum, { ...resolved, status: "em_andamento" })).toThrow(/resolvido/);
    expect(() => assertCanRate(comum, { ...resolved, rating: 4 })).toThrow(/já foi avaliado/);
  });
});

describe("admin role (restricted like a common user)", () => {
  const adminUser = { id: 4, role: "admin" as const };

  it("only sees their own tickets", () => {
    expect(canViewTicket(adminUser, { requesterId: 4 })).toBe(true);
    expect(canViewTicket(adminUser, { requesterId: 99 })).toBe(false);
  });

  it("cannot write internal notes, comment on closed tickets or record solutions", () => {
    const ticket = { requesterId: 4, assigneeId: 7, status: "em_andamento" as const };
    expect(() => assertCanAddComment(adminUser, ticket, true)).toThrow(/notas internas/);
    expect(() => assertCanAddComment(adminUser, { ...ticket, status: "fechado" }, false)).toThrow(/fechado/);
    expect(() => assertCanSetSolution(adminUser, { assigneeId: 7, machineId: 3 }, "Ok")).toThrow(/responsável/);
  });

  it("can rate their own resolved ticket, like a common user", () => {
    expect(() => assertCanRate(adminUser, { requesterId: 4, status: "resolvido", rating: null })).not.toThrow();
  });
});

describe("assertCanConfirmSolution", () => {
  const pending = { requesterId: 2, solution: "Troquei o cabo", solutionConfirmedAt: null };

  it("lets the requester confirm a pending solution", () => {
    expect(() => assertCanConfirmSolution(comum, pending)).not.toThrow();
  });

  it("denies others, missing solutions and second confirmations", () => {
    expect(() => assertCanConfirmSolution(support, pending)).toThrow(/Somente quem abriu/);
    expect(() => assertCanConfirmSolution(comum, { ...pending, solution: null })).toThrow(/ainda não tem/);
    expect(() => assertCanConfirmSolution(comum, { ...pending, solutionConfirmedAt: now })).toThrow(/já foi confirmada/);
  });
});

describe("reopening", () => {
  const resolvedAt = new Date("2026-10-23T10:00:00Z");
  const resolved = { requesterId: 2, status: "resolvido" as const, resolvedAt };

  it("computes the deadline from the resolution date", () => {
    expect(reopenDeadline(resolvedAt, 24)).toEqual(new Date("2026-10-24T10:00:00Z"));
    expect(reopenDeadline(resolvedAt, null)).toBeNull();
  });

  it("lets the requester reopen within the window, or anytime without a window", () => {
    expect(() => assertCanReopen(comum, resolved, 24, new Date("2026-10-24T09:59:00Z"))).not.toThrow();
    expect(() => assertCanReopen(comum, resolved, null, new Date("2027-01-01T00:00:00Z"))).not.toThrow();
  });

  it("blocks after the window, for other users and for tickets that are not resolved", () => {
    expect(() => assertCanReopen(comum, resolved, 24, new Date("2026-10-24T10:01:00Z"))).toThrow(/prazo/);
    expect(() => assertCanReopen(support, resolved, null, resolvedAt)).toThrow(/Somente quem abriu/);
    expect(() => assertCanReopen(comum, { ...resolved, status: "fechado" }, null, resolvedAt)).toThrow(/resolvido/);
  });
});
