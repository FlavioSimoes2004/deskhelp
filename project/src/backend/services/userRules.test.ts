import { describe, expect, it } from "vitest";
import { assertCanManageUser, assertCanUpdateUser } from "./userRules.js";
import { HttpError } from "../utils/httpError.js";

const admin = { id: 1, role: "admin" as const };
const superSupport = { id: 3, role: "super_support" as const };
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
  it("lets super support manage anyone, including creating admins and super supports", () => {
    expect(() => assertCanManageUser(superSupport, { role: "admin" }, { role: "comum" })).not.toThrow();
    expect(() => assertCanManageUser(superSupport, null, { role: "admin" })).not.toThrow();
    expect(() => assertCanManageUser(superSupport, { role: "super_support" }, { role: "super_support" })).not.toThrow();
  });

  it("lets support create and edit common and support users", () => {
    expect(() => assertCanManageUser(support, null, { role: "comum" })).not.toThrow();
    expect(() => assertCanManageUser(support, { role: "comum" }, { role: "support" })).not.toThrow();
  });

  it("blocks support from creating or promoting administrators", () => {
    expect(() => assertCanManageUser(support, null, { role: "admin" })).toThrow(/criar nem promover/);
    expect(() => assertCanManageUser(support, { role: "comum" }, { role: "admin" })).toThrow(/criar nem promover/);
    expect(() => assertCanManageUser(support, null, { role: "super_support" })).toThrow(/criar nem promover/);
  });

  it("blocks support from editing an administrator", () => {
    expect(() => assertCanManageUser(support, { role: "admin" }, {})).toThrow(/administradores/);
    expect(() => assertCanManageUser(support, { role: "super_support" }, {})).toThrow(/super suportes/);
  });
});
