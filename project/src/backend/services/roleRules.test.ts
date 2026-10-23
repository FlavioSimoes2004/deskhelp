import { describe, expect, it } from "vitest";
import { canAdministrate, canViewAllTickets, isProtectedRole, isRequesterOnly, isStaff, isSuper } from "./roleRules.js";

describe("role capabilities", () => {
  it("gives super support everything", () => {
    expect([isSuper, isStaff, canAdministrate].every((f) => f("super_support"))).toBe(true);
    expect(isRequesterOnly("super_support")).toBe(false);
  });

  it("keeps support as staff without administration", () => {
    expect(isStaff("support")).toBe(true);
    expect(isSuper("support") || canAdministrate("support") || isRequesterOnly("support")).toBe(false);
  });

  it("restricts admin like a common user, plus administration pages", () => {
    expect(isRequesterOnly("admin")).toBe(true);
    expect(canAdministrate("admin")).toBe(true);
    expect(isStaff("admin") || isSuper("admin")).toBe(false);
  });

  it("restricts common users to their own tickets", () => {
    expect(isRequesterOnly("comum")).toBe(true);
    expect(isStaff("comum") || canAdministrate("comum") || isSuper("comum")).toBe(false);
  });

  it("protects admin and super support accounts from support", () => {
    expect(isProtectedRole("admin") && isProtectedRole("super_support")).toBe(true);
    expect(isProtectedRole("support") || isProtectedRole("comum")).toBe(false);
  });
});

describe("canViewAllTickets", () => {
  it("lets staff and admins see every ticket, but not common users", () => {
    expect(["support", "super_support", "admin"].every((r) => canViewAllTickets(r as "admin"))).toBe(true);
    expect(canViewAllTickets("comum")).toBe(false);
  });
});
