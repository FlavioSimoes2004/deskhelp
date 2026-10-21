import { describe, expect, it } from "vitest";
import { sessionStatus } from "./sessionRules.js";

const user = { active: true, sessionId: "sessao-nova" };

describe("sessionStatus", () => {
  it("accepts the token of the current session", () => {
    expect(sessionStatus("sessao-nova", user)).toBe("ok");
  });

  it("detects a token from an older login (account logged in elsewhere)", () => {
    expect(sessionStatus("sessao-antiga", user)).toBe("replaced");
  });

  it("rejects tokens after logout, without a session, or for inactive/missing accounts", () => {
    expect(sessionStatus("sessao-nova", { ...user, sessionId: null })).toBe("invalid");
    expect(sessionStatus(null, user)).toBe("invalid");
    expect(sessionStatus("sessao-nova", { ...user, active: false })).toBe("invalid");
    expect(sessionStatus("sessao-nova", null)).toBe("invalid");
  });
});
