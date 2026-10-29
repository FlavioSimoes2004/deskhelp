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
    expect(accentTokens("#007aff")!["--on-petrol"]).toBe("#ffffff");
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

});

describe("accentTokens in dark mode", () => {
  const dark = (hex: string) => accentTokens(hex, "dark")!;

  it("uses Apple's dark variants for the system colors", () => {
    expect(dark("#007aff")["--petrol"]).toBe("#0a84ff");
    expect(dark("#34c759")["--petrol"]).toBe("#30d158");
  });

  it("keeps links and tags readable on the dark cards", () => {
    for (const color of ["#0e5e6f", "#000080", "#3a0000", ...ACCENT_PRESETS.map((p) => p.color)]) {
      const t = dark(color);
      expect(contrast(rgb(t["--petrol-text"]), [28, 28, 30])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(t["--petrol-strong"]), rgb(t["--petrol-soft"]))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(t["--on-petrol"]), rgb(t["--petrol"]))).toBeGreaterThanOrEqual(3);
    }
  });
});
