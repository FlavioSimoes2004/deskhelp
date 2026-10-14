import { describe, expect, it } from "vitest";
import { creationEntries, diffMachine } from "./machineRules.js";

const machine = { macAddress: "AA:BB:CC:DD:EE:FF", ipAddress: "10.0.0.1", userId: 2 };

describe("diffMachine", () => {
  it("returns only the fields that actually change", () => {
    expect(diffMachine(machine, { macAddress: "AA:BB:CC:DD:EE:FF", ipAddress: "10.0.0.2", userId: 2 })).toEqual([
      { field: "ipAddress", oldValue: "10.0.0.1", newValue: "10.0.0.2" },
    ]);
  });

  it("records removing the user or the IP as null", () => {
    expect(diffMachine(machine, { userId: null, ipAddress: null })).toEqual([
      { field: "userId", oldValue: "2", newValue: null },
      { field: "ipAddress", oldValue: "10.0.0.1", newValue: null },
    ]);
  });

  it("ignores omitted fields", () => {
    expect(diffMachine(machine, {})).toEqual([]);
  });
});

describe("creationEntries", () => {
  it("records the creation and the initial IP and user", () => {
    expect(creationEntries(machine)).toEqual([
      { field: "created", oldValue: null, newValue: "AA:BB:CC:DD:EE:FF" },
      { field: "ipAddress", oldValue: null, newValue: "10.0.0.1" },
      { field: "userId", oldValue: null, newValue: "2" },
    ]);
  });

  it("skips initial values that were left empty", () => {
    expect(creationEntries({ ...machine, ipAddress: null, userId: null })).toHaveLength(1);
  });
});
