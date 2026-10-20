import { describe, expect, it } from "vitest";
import { isNotInPast, parseLocalDateTime } from "./agendaRules.js";

describe("parseLocalDateTime", () => {
  it("reads the date and time from the form field", () => {
    expect(parseLocalDateTime("2026-10-20T14:30")).toEqual(new Date(2026, 9, 20, 14, 30, 0));
  });

  it("rejects malformed or impossible values", () => {
    expect(parseLocalDateTime("2026-10-20 14:30")).toBeNull();
    expect(parseLocalDateTime("2026-02-31T10:00")).toBeNull();
    expect(parseLocalDateTime("2026-10-20T25:00")).toBeNull();
    expect(parseLocalDateTime("")).toBeNull();
  });
});

describe("isNotInPast", () => {
  const now = new Date(2026, 9, 20, 14, 30, 30);

  it("accepts future times and the current minute", () => {
    expect(isNotInPast(new Date(2026, 9, 20, 15, 0), now)).toBe(true);
    expect(isNotInPast(new Date(2026, 9, 20, 14, 30), now)).toBe(true);
  });

  it("rejects times in the past", () => {
    expect(isNotInPast(new Date(2026, 9, 20, 14, 28), now)).toBe(false);
  });
});
