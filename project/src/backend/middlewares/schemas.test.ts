import { describe, expect, it } from "vitest";
import {
  createMachineSchema,
  createTicketSchema,
  loginSchema,
  registerSchema,
  ticketQuerySchema,
  updateMachineSchema,
} from "./schemas.js";

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

describe("createMachineSchema", () => {
  it("normalises the MAC address to uppercase with colons", () => {
    for (const mac of ["aa-bb-cc-dd-ee-0f", "aabb.ccdd.ee0f", "aabbccddee0f", " AA:BB:CC:DD:EE:0F "]) {
      expect(createMachineSchema.parse({ macAddress: mac }).macAddress).toBe("AA:BB:CC:DD:EE:0F");
    }
  });

  it("rejects an invalid MAC address", () => {
    expect(createMachineSchema.safeParse({ macAddress: "AA:BB:CC:DD:EE" }).success).toBe(false);
    expect(createMachineSchema.safeParse({ macAddress: "GG:BB:CC:DD:EE:FF" }).success).toBe(false);
  });

  it("accepts IPv4 and IPv6, and turns an empty IP into null", () => {
    expect(createMachineSchema.parse({ macAddress: "aabbccddeeff", ipAddress: "192.168.0.10" }).ipAddress).toBe(
      "192.168.0.10",
    );
    expect(createMachineSchema.parse({ macAddress: "aabbccddeeff", ipAddress: "fe80::1" }).ipAddress).toBe("fe80::1");
    expect(createMachineSchema.parse({ macAddress: "aabbccddeeff", ipAddress: "" }).ipAddress).toBeNull();
    expect(createMachineSchema.safeParse({ macAddress: "aabbccddeeff", ipAddress: "300.1.1.1" }).success).toBe(false);
  });

  it("defaults to no IP and no user", () => {
    expect(createMachineSchema.parse({ macAddress: "aabbccddeeff" })).toEqual({
      macAddress: "AA:BB:CC:DD:EE:FF",
      ipAddress: null,
      description: null,
      userId: null,
    });
  });
});

describe("machine description", () => {
  it("trims the description and turns an empty one into null", () => {
    expect(createMachineSchema.parse({ macAddress: "aabbccddeeff", description: "  Notebook  " }).description).toBe(
      "Notebook",
    );
    expect(updateMachineSchema.parse({ description: "  " })).toEqual({ description: null });
  });

  it("rejects descriptions longer than 255 characters", () => {
    expect(updateMachineSchema.safeParse({ description: "x".repeat(256) }).success).toBe(false);
  });
});

describe("updateMachineSchema", () => {
  it("keeps omitted fields undefined and allows removing the user", () => {
    expect(updateMachineSchema.parse({ userId: null })).toEqual({ userId: null });
  });

  it("rejects an empty update", () => {
    expect(updateMachineSchema.safeParse({}).success).toBe(false);
  });
});
