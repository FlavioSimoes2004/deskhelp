import { describe, expect, it } from "vitest";
import { formatAttachmentIds, MAX_ATTACHMENT_IDS_LENGTH, parseAttachmentIds } from "./ticketComments.js";

describe("formatAttachmentIds", () => {
  it("joins the ids with a comma and a space", () => {
    expect(formatAttachmentIds([1, 2, 10])).toBe("1, 2, 10");
  });

  it("returns null when there are no attachments", () => {
    expect(formatAttachmentIds([])).toBeNull();
  });

  it("refuses a list longer than the column", () => {
    const ids = Array.from({ length: 40 }, (_, i) => 1000 + i);
    expect(ids.join(", ").length).toBeGreaterThan(MAX_ATTACHMENT_IDS_LENGTH);
    expect(() => formatAttachmentIds(ids)).toThrow();
  });
});

describe("parseAttachmentIds", () => {
  it("reads the ids written by formatAttachmentIds", () => {
    expect(parseAttachmentIds(formatAttachmentIds([1, 2, 10]))).toEqual([1, 2, 10]);
  });

  it("tolerates missing spaces and empty items", () => {
    expect(parseAttachmentIds("3,4, ,5")).toEqual([3, 4, 5]);
  });

  it("returns an empty list for null or empty text", () => {
    expect(parseAttachmentIds(null)).toEqual([]);
    expect(parseAttachmentIds("")).toEqual([]);
  });
});
