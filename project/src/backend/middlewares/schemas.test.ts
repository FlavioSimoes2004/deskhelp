import { describe, expect, it } from "vitest";
import { createTicketSchema, loginSchema, registerSchema, ticketQuerySchema } from "./schemas.js";

describe("registerSchema", () => {
  it("normalises the email to trimmed lowercase", () => {
    const parsed = registerSchema.parse({ name: "Ana", email: "  Ana@Empresa.COM ", password: "senha-forte" });
    expect(parsed.email).toBe("ana@empresa.com");
  });

  it("rejects passwords shorter than 8 characters", () => {
    expect(registerSchema.safeParse({ name: "Ana", email: "ana@empresa.com", password: "curta" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects a missing password", () => {
    expect(loginSchema.safeParse({ email: "ana@empresa.com" }).success).toBe(false);
  });
});

describe("createTicketSchema", () => {
  it("defaults the priority to media", () => {
    const parsed = createTicketSchema.parse({ title: "VPN caiu", description: "Sem acesso desde 9h", categoryId: 2 });
    expect(parsed.priority).toBe("media");
  });

  it("rejects an unknown priority", () => {
    const result = createTicketSchema.safeParse({
      title: "VPN caiu",
      description: "Sem acesso desde 9h",
      categoryId: 2,
      priority: "urgente",
    });
    expect(result.success).toBe(false);
  });
});

describe("ticketQuerySchema", () => {
  it("coerces paging values from the query string and caps the page size", () => {
    const parsed = ticketQuerySchema.parse({ page: "3", pageSize: "500" });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(100);
  });
});
