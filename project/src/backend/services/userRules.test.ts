import { describe, expect, it } from "vitest";
import { assertCanManageUser, assertCanUpdateUser } from "./userRules.js";
import { HttpError } from "../utils/httpError.js";

const admin = { id: 1, role: "admin" as const };
const support = { id: 7, role: "support" as const };

describe("assertCanUpdateUser", () => {
  it("blocks an admin from removing their own admin role", () => {
    expect(() => assertCanUpdateUser(admin, 1, { role: "comum" })).toThrow(HttpError);
  });

  it("blocks an admin from deactivating their own account", () => {
    expect(() => assertCanUpdateUser(admin, 1, { active: false })).toThrow(HttpError);
  });

  it("allows an admin to rename their own account", () => {
    expect(() => assertCanUpdateUser(admin, 1, { name: "Novo nome" })).not.toThrow();
  });

  it("allows an admin to demote and deactivate another user", () => {
    expect(() => assertCanUpdateUser(admin, 2, { role: "comum", active: false })).not.toThrow();
  });

  it("lets support save their own profile while keeping the same role", () => {
    expect(() => assertCanUpdateUser(support, 7, { role: "support", name: "Novo nome" })).not.toThrow();
  });

  it("blocks support from changing their own role", () => {
    expect(() => assertCanUpdateUser(support, 7, { role: "admin" })).toThrow(HttpError);
  });
});

describe("assertCanManageUser", () => {
  it("lets an admin manage anyone, including creating admins", () => {
    expect(() => assertCanManageUser(admin, { role: "admin" }, { role: "comum" })).not.toThrow();
    expect(() => assertCanManageUser(admin, null, { role: "admin" })).not.toThrow();
  });

  it("lets support create and edit common and support users", () => {
    expect(() => assertCanManageUser(support, null, { role: "comum" })).not.toThrow();
    expect(() => assertCanManageUser(support, { role: "comum" }, { role: "support" })).not.toThrow();
  });

  it("blocks support from creating or promoting administrators", () => {
    expect(() => assertCanManageUser(support, null, { role: "admin" })).toThrow(/criar ou promover/);
    expect(() => assertCanManageUser(support, { role: "comum" }, { role: "admin" })).toThrow(/criar ou promover/);
  });

  it("blocks support from editing an administrator", () => {
    expect(() => assertCanManageUser(support, { role: "admin" }, {})).toThrow(/administradores/);
  });
});
