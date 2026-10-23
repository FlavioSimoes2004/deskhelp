import { describe, expect, it } from "vitest";
import {
  assertBelowOpenTicketLimit,
  assertCanWriteUsers,
  assertRatingsOpen,
  assertTicketAttachmentsAllowed,
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
    ).toEqual({
      hidePriorityForComum: true,
      priorityByStaffOnly: false,
      blockSupportUserManagement: false,
      maxTicketAttachments: 5,
      ratingsLocked: false,
      reopenWindowHours: null,
      commentsLocked: true,
      maxOpenTicketsPerUser: 3,
    });
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
      blockSupportUserManagement: false,
      maxTicketAttachments: 5,
      ratingsLocked: false,
      reopenWindowHours: null,
      commentsLocked: false,
      maxOpenTicketsPerUser: null,
    });
  });
});

describe("hidesPriority", () => {
  const on = { ...DEFAULT_SETTINGS, hidePriorityForComum: true };

  it("hides priority from common users and admins (same rules), only when enabled", () => {
    expect(hidesPriority({ id: 1, role: "comum" }, on)).toBe(true);
    expect(hidesPriority({ id: 1, role: "admin" }, on)).toBe(true);
    expect(hidesPriority({ id: 1, role: "support" }, on)).toBe(false);
    expect(hidesPriority({ id: 1, role: "super_support" }, on)).toBe(false);
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

describe("assertCanWriteUsers", () => {
  const blocked = { ...DEFAULT_SETTINGS, blockSupportUserManagement: true };

  it("blocks support from creating or editing users when enabled", () => {
    expect(() => assertCanWriteUsers({ id: 7, role: "support" }, blocked)).toThrow(/super suporte/);
  });

  it("never blocks super support, and allows support when disabled", () => {
    expect(() => assertCanWriteUsers({ id: 1, role: "super_support" }, blocked)).not.toThrow();
    expect(() => assertCanWriteUsers({ id: 7, role: "support" }, DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe("ratings and reopen settings", () => {
  it("reads the reopen window in hours, treating 0 as no limit", () => {
    expect(parseSettings({ reopen_window_hours: "48" }).reopenWindowHours).toBe(48);
    expect(parseSettings({ reopen_window_hours: "0" }).reopenWindowHours).toBeNull();
  });

  it("blocks new ratings when locked", () => {
    expect(() => assertRatingsOpen({ ...DEFAULT_SETTINGS, ratingsLocked: true })).toThrow(/avaliação/);
    expect(() => assertRatingsOpen(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe("ticket attachments at creation", () => {
  it("defaults to the system maximum and caps saved values to it", () => {
    expect(parseSettings({}).maxTicketAttachments).toBe(5);
    expect(parseSettings({ max_ticket_attachments: "2" }).maxTicketAttachments).toBe(2);
    expect(parseSettings({ max_ticket_attachments: "0" }).maxTicketAttachments).toBe(0);
    expect(parseSettings({ max_ticket_attachments: "99" }).maxTicketAttachments).toBe(5);
  });

  it("blocks more attachments than allowed, and any attachment when the limit is 0", () => {
    expect(() => assertTicketAttachmentsAllowed(2, { ...DEFAULT_SETTINGS, maxTicketAttachments: 2 })).not.toThrow();
    expect(() => assertTicketAttachmentsAllowed(3, { ...DEFAULT_SETTINGS, maxTicketAttachments: 2 })).toThrow(/no máximo 2/);
    expect(() => assertTicketAttachmentsAllowed(1, { ...DEFAULT_SETTINGS, maxTicketAttachments: 0 })).toThrow(/não são permitidos/);
    expect(() => assertTicketAttachmentsAllowed(0, { ...DEFAULT_SETTINGS, maxTicketAttachments: 0 })).not.toThrow();
  });
});
