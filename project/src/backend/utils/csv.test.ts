import { describe, expect, it } from "vitest";
import { toCsv } from "./csv.js";

describe("toCsv", () => {
  it("joins headers and rows with CRLF line breaks", () => {
    expect(toCsv(["id", "titulo"], [[1, "Rede lenta"]])).toBe("id,titulo\r\n1,Rede lenta");
  });

  it("quotes values containing commas, quotes or line breaks", () => {
    expect(toCsv(["v"], [['a,b'], ['diz "oi"'], ["linha1\nlinha2"]])).toBe(
      'v\r\n"a,b"\r\n"diz ""oi"""\r\n"linha1\nlinha2"',
    );
  });

  it("writes null and undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });

  it("neutralises values that a spreadsheet would run as a formula", () => {
    expect(toCsv(["v"], [["=SOMA(A1)"], ["+1"], ["@cmd"]])).toBe("v\r\n'=SOMA(A1)\r\n'+1\r\n'@cmd");
  });
});
