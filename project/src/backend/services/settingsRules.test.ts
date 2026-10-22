import { describe, expect, it } from "vitest";
import {
  assertBelowOpenTicketLimit,
  assertCommentsOpen,
  DEFAULT_SETTINGS,
  hidesPriority,
  newTicketPriority,
  parseSettings,
  serializeSetting,
} from "./settingsRules.js";

describe("parseSettings", () => {
  it("uses the defaults when nothing was saved", () => {
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("reads saved values", () => {
    expect(
      parseSettings({ hide_priority_for_comum: "1", comments_locked: "1", max_open_tickets_per_user: "3" }),
    ).toEqual({ hidePriorityForComum: true, priorityByStaffOnly: false, commentsLocked: true, maxOpenTicketsPerUser: 3 });
  });

  it("treats 0 or invalid limits as no limit", () => {
    expect(parseSettings({ max_open_tickets_per_user: "0" }).maxOpenTicketsPerUser).toBeNull();
    expect(parseSettings({ max_open_tickets_per_user: "abc" }).maxOpenTicketsPerUser).toBeNull();
  });

  it("round-trips through serializeSetting", () => {
    const rows = {
      hide_priority_for_comum: serializeSetting(true),
      comments_locked: serializeSetting(false),
      max_open_tickets_per_user: serializeSetting(null),
    };
    expect(parseSettings(rows)).toEqual({
      hidePriorityForComum: true,
      priorityByStaffOnly: false,
      commentsLocked: false,
      maxOpenTicketsPerUser: null,
    });
  });
});

describe("hidesPriority", () => {
  const on = { ...DEFAULT_SETTINGS, hidePriorityForComum: true };

  it("hides priority only from common users, and only when enabled", () => {
    expect(hidesPriority({ id: 1, role: "comum" }, on)).toBe(true);
    expect(hidesPriority({ id: 1, role: "support" }, on)).toBe(false);
    expect(hidesPriority({ id: 1, role: "admin" }, on)).toBe(false);
    expect(hidesPriority({ id: 1, role: "comum" }, DEFAULT_SETTINGS)).toBe(false);
  });
});

describe("assertCommentsOpen", () => {
  it("blocks comments when the conversation is locked", () => {
    expect(() => assertCommentsOpen({ ...DEFAULT_SETTINGS, commentsLocked: true })).toThrow(/bloqueada/);
    expect(() => assertCommentsOpen(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe("assertBelowOpenTicketLimit", () => {
  const limit2 = { ...DEFAULT_SETTINGS, maxOpenTicketsPerUser: 2 };

  it("allows opening while below the limit", () => {
    expect(() => assertBelowOpenTicketLimit(1, limit2)).not.toThrow();
  });

  it("blocks when the limit is reached", () => {
    expect(() => assertBelowOpenTicketLimit(2, limit2)).toThrow(/limite é 2/);
  });

  it("never blocks without a limit", () => {
    expect(() => assertBelowOpenTicketLimit(500, DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe("newTicketPriority", () => {
  const comum = { id: 2, role: "comum" as const };
  const support = { id: 7, role: "support" as const };

  it("keeps the chosen priority by default and for staff", () => {
    expect(newTicketPriority(comum, DEFAULT_SETTINGS, "alta", "media")).toBe("alta");
    expect(newTicketPriority(support, { ...DEFAULT_SETTINGS, priorityByStaffOnly: true }, "alta", "media")).toBe("alta");
  });

  it("leaves common users' tickets without priority when only staff sets it", () => {
    expect(newTicketPriority(comum, { ...DEFAULT_SETTINGS, priorityByStaffOnly: true }, "alta", "media")).toBeNull();
  });

  it("uses the default priority when it is only hidden", () => {
    expect(newTicketPriority(comum, { ...DEFAULT_SETTINGS, hidePriorityForComum: true }, "alta", "media")).toBe("media");
  });

  it("prefers 'no priority' when both settings are on", () => {
    const both = { ...DEFAULT_SETTINGS, hidePriorityForComum: true, priorityByStaffOnly: true };
    expect(newTicketPriority(comum, both, "alta", "media")).toBeNull();
  });
});
