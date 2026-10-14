import { describe, expect, it } from "vitest";
import { assertCanUpdateUser } from "./userRules.js";
import { HttpError } from "../utils/httpError.js";

describe("assertCanUpdateUser", () => {
  it("blocks an admin from removing their own admin role", () => {
    expect(() => assertCanUpdateUser(1, 1, { role: "comum" })).toThrow(HttpError);
  });

  it("blocks an admin from deactivating their own account", () => {
    expect(() => assertCanUpdateUser(1, 1, { active: false })).toThrow(HttpError);
  });

  it("allows an admin to rename their own account", () => {
    expect(() => assertCanUpdateUser(1, 1, { name: "Novo nome" })).not.toThrow();
  });

  it("allows an admin to demote and deactivate another user", () => {
    expect(() => assertCanUpdateUser(1, 2, { role: "comum", active: false })).not.toThrow();
  });
});
