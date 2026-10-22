import { describe, expect, it } from "vitest";
import { normalizeCategoryName } from "./categoryRules.js";

describe("normalizeCategoryName", () => {
  it("uppercases letters, including accented ones", () => {
    expect(normalizeCategoryName("Segurança da informação")).toBe("SEGURANÇA DA INFORMAÇÃO");
    expect(normalizeCategoryName("e-mail")).toBe("E-MAIL");
  });

  it("trims and collapses spaces", () => {
    expect(normalizeCategoryName("  rede   e  internet ")).toBe("REDE E INTERNET");
  });

  it("keeps numbers and symbols", () => {
    expect(normalizeCategoryName("Sistemas internos (ERP) 2")).toBe("SISTEMAS INTERNOS (ERP) 2");
  });
});
