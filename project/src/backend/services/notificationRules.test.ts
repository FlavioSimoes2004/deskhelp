import { describe, expect, it } from "vitest";
import { assignmentRecipient, commentRecipients } from "./notificationRules.js";

const superSupport = { id: 1, role: "super_support" as const };
const support = { id: 7, role: "support" as const };

describe("assignmentRecipient", () => {
  it("notifies the new assignee when an superSupport assigns someone else", () => {
    expect(assignmentRecipient(superSupport, { assigneeId: null }, { assigneeId: 7 })).toBe(7);
    expect(assignmentRecipient(superSupport, { assigneeId: 8 }, { assigneeId: 7 })).toBe(7);
  });

  it("does not notify when the superSupport assigns the ticket to themselves", () => {
    expect(assignmentRecipient(superSupport, { assigneeId: null }, { assigneeId: 1 })).toBeNull();
  });

  it("does not notify when the assignee does not change or is removed", () => {
    expect(assignmentRecipient(superSupport, { assigneeId: 7 }, { assigneeId: 7 })).toBeNull();
    expect(assignmentRecipient(superSupport, { assigneeId: 7 }, { assigneeId: null })).toBeNull();
    expect(assignmentRecipient(superSupport, { assigneeId: 7 }, {})).toBeNull();
  });

  it("does not notify when support assumes a ticket", () => {
    expect(assignmentRecipient(support, { assigneeId: null }, { assigneeId: 7 })).toBeNull();
  });
});

describe("commentRecipients", () => {
  it("notifies the requester and the assignee, except the author", () => {
    expect(commentRecipients(7, { requesterId: 2, assigneeId: 7 })).toEqual([2]);
    expect(commentRecipients(2, { requesterId: 2, assigneeId: 7 })).toEqual([7]);
  });

  it("notifies both when someone else comments", () => {
    expect(commentRecipients(1, { requesterId: 2, assigneeId: 7 })).toEqual([2, 7]);
  });

  it("skips a missing assignee and does not duplicate a requester who is also the assignee", () => {
    expect(commentRecipients(1, { requesterId: 2, assigneeId: null })).toEqual([2]);
    expect(commentRecipients(1, { requesterId: 2, assigneeId: 2 })).toEqual([2]);
  });
});

describe("commentRecipients for internal notes", () => {
  it("does not notify a common requester", () => {
    expect(commentRecipients(1, { requesterId: 2, assigneeId: 7 }, { requesterIsStaff: false })).toEqual([7]);
  });

  it("notifies a requester who is staff", () => {
    expect(commentRecipients(1, { requesterId: 2, assigneeId: 7 }, { requesterIsStaff: true })).toEqual([2, 7]);
  });
});

describe("assignmentRecipient for the restricted admin role", () => {
  it("does not notify on behalf of admins, who no longer manage tickets", () => {
    expect(assignmentRecipient({ id: 3, role: "admin" }, { assigneeId: null }, { assigneeId: 7 })).toBeNull();
  });
});
