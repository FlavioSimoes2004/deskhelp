import { describe, expect, it } from "vitest";
import {
  appendCommentLine,
  buildCommentLine,
  charLength,
  formatCommentDate,
  MAX_COMMENTS_LENGTH,
  parseComments,
} from "./ticketComments.js";

const at = new Date(2026, 9, 14, 12, 20, 20);

describe("buildCommentLine", () => {
  it("writes the prefix in the documented format", () => {
    expect(buildCommentLine({ at, userId: 1, attachmentIds: [1, 2, 3, 4], body: "Segue o print" })).toBe(
      "[2026-10-14 12:20:20, users:1, attachs:1|2|3|4] Segue o print",
    );
  });

  it("leaves attachs empty when there are no attachments", () => {
    expect(buildCommentLine({ at, userId: 7, attachmentIds: [], body: "Ok" })).toBe(
      "[2026-10-14 12:20:20, users:7, attachs:] Ok",
    );
  });

  it("turns line breaks into spaces so the message stays on one line", () => {
    expect(buildCommentLine({ at, userId: 1, attachmentIds: [], body: "linha 1\r\n\nlinha 2 " })).toBe(
      "[2026-10-14 12:20:20, users:1, attachs:] linha 1 linha 2",
    );
  });
});

describe("formatCommentDate", () => {
  it("pads every part with zeros", () => {
    expect(formatCommentDate(new Date(2026, 0, 2, 3, 4, 5))).toBe("2026-01-02 03:04:05");
  });
});

describe("appendCommentLine", () => {
  it("starts the column with the first message", () => {
    expect(appendCommentLine(null, "a")).toBe("a");
  });

  it("separates messages with a line break", () => {
    expect(appendCommentLine("a", "b")).toBe("a\nb");
  });

  it("refuses a message that would overflow the column", () => {
    const current = "x".repeat(MAX_COMMENTS_LENGTH - 2);
    expect(appendCommentLine(current, "y")).toBe(`${current}\ny`);
    expect(appendCommentLine(current, "yz")).toBeNull();
  });

  it("counts characters like MariaDB (an emoji is one character)", () => {
    expect(charLength("😀")).toBe(1);
    expect(appendCommentLine(null, "😀".repeat(MAX_COMMENTS_LENGTH))).not.toBeNull();
  });
});

describe("parseComments", () => {
  it("reads each line as a message", () => {
    const text = [
      "[2026-10-14 12:20:20, users:1, attachs:1|2] Primeira",
      "[2026-10-14 13:00:00, users:5, attachs:] Segunda, com [colchetes]",
    ].join("\n");
    expect(parseComments(text)).toEqual([
      { index: 1, createdAt: at, userId: 1, attachmentIds: [1, 2], body: "Primeira" },
      {
        index: 2,
        createdAt: new Date(2026, 9, 14, 13, 0, 0),
        userId: 5,
        attachmentIds: [],
        body: "Segunda, com [colchetes]",
      },
    ]);
  });

  it("round-trips a built line", () => {
    const line = buildCommentLine({ at, userId: 3, attachmentIds: [9], body: "Teste" });
    expect(parseComments(line)).toEqual([{ index: 1, createdAt: at, userId: 3, attachmentIds: [9], body: "Teste" }]);
  });

  it("returns nothing for an empty column and skips malformed lines", () => {
    expect(parseComments(null)).toEqual([]);
    expect(parseComments("sem prefixo\n[2026-10-14 12:20:20, users:2, attachs:] Ok")).toHaveLength(1);
  });
});
