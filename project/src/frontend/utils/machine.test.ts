import { describe, expect, it } from "vitest";
import { formatGb, machineLabel, machineSpecs } from "./machine";

const empty = { ramGb: null, ramType: null, cpu: null, storageGb: null, storageType: null, gpu: null };

describe("machineLabel", () => {
  it("prefers the name, then the description", () => {
    expect(machineLabel({ name: "RECEPCAO-01", macAddress: "AA:BB:CC:DD:EE:FF", description: "x" })).toBe(
      "RECEPCAO-01 (AA:BB:CC:DD:EE:FF)",
    );
    expect(machineLabel({ name: null, macAddress: "AA:BB:CC:DD:EE:FF", description: "Notebook" })).toBe(
      "AA:BB:CC:DD:EE:FF (Notebook)",
    );
    expect(machineLabel({ name: null, macAddress: "AA:BB:CC:DD:EE:FF", description: null })).toBe("AA:BB:CC:DD:EE:FF");
  });
});

describe("formatGb", () => {
  it("switches to TB from 1024 GB", () => {
    expect(formatGb(512)).toBe("512 GB");
    expect(formatGb(1024)).toBe("1 TB");
    expect(formatGb(1536)).toBe("1,5 TB");
  });
});

describe("machineSpecs", () => {
  it("summarizes the filled parts only", () => {
    expect(
      machineSpecs({ ...empty, ramGb: 16, ramType: "DDR4", cpu: "Core i5", storageGb: 512, storageType: "ssd", gpu: "GTX 1650" }),
    ).toBe("16 GB DDR4 · Core i5 · 512 GB SSD · GTX 1650");
    expect(machineSpecs({ ...empty, storageType: "hd" })).toBe("HD");
  });

  it("returns null when nothing is filled", () => {
    expect(machineSpecs(empty)).toBeNull();
  });
});
