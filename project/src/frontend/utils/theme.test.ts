import { describe, expect, it } from "vitest";
import { ACCENT_PRESETS, accentTokens, contrast, hexToRgb, rgbToHex } from "./theme";

const rgb = (hex: string) => hexToRgb(hex)!;

describe("hexToRgb / rgbToHex", () => {
  it("converts both ways", () => {
    expect(hexToRgb("#0e5e6f")).toEqual([14, 94, 111]);
    expect(rgbToHex([14, 94, 111])).toBe("#0e5e6f");
  });

  it("rejects invalid colors", () => {
    expect(hexToRgb("#12")).toBeNull();
    expect(hexToRgb("azul")).toBeNull();
    expect(accentTokens("azul")).toBeNull();
  });
});

describe("accentTokens", () => {
  it("uses white text on dark colors and dark text on light colors", () => {
    expect(accentTokens("#0e5e6f")!["--on-petrol"]).toBe("#ffffff");
    expect(accentTokens("#f5d000")!["--on-petrol"]).not.toBe("#ffffff");
  });

  it("keeps links and tag text readable even for very light colors", () => {
    for (const color of ["#f5d000", "#ffffff", "#7fffd4", ...ACCENT_PRESETS.map((p) => p.color)]) {
      const t = accentTokens(color)!;
      expect(contrast(rgb(t["--petrol-text"]), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(t["--petrol-strong"]), rgb(t["--petrol-soft"]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(t["--on-petrol"]), rgb(t["--petrol"]))).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the sidebar accent visible on the dark menu even for very dark colors", () => {
    const t = accentTokens("#000000")!;
    expect(contrast(rgb(t["--petrol-light"]), [23, 32, 45])).toBeGreaterThanOrEqual(4.5);
  });
});
