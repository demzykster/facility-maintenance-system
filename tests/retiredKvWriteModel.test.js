import { describe, expect, it } from "vitest";
import { activeKvWriteRecords, retiredKvWriteKey, retiredKvWritePrefixes } from "../src/retiredKvWriteModel.js";

describe("retired KV write model", () => {
  it("retires presence writes only in production API mode", () => {
    expect(retiredKvWritePrefixes({ appMode: "production", storageProvider: "api" })).toEqual(["presence:"]);
    expect(retiredKvWritePrefixes({ appMode: "demo", storageProvider: "api" })).toEqual([]);
    expect(retiredKvWriteKey("presence:user-1", { appMode: "production", storageProvider: "api" })).toBe("presence:");
    expect(retiredKvWriteKey("ticket:T-1", { appMode: "production", storageProvider: "api" })).toBe("");
  });

  it("separates active and retired batch writes", () => {
    expect(activeKvWriteRecords([
      { key: "presence:user-1", value: "{}" },
      { key: "ticket:T-1", value: "{}" }
    ], { appMode: "production", storageProvider: "api" })).toEqual({
      active: [{ key: "ticket:T-1", value: "{}" }],
      retired: [{ key: "presence:user-1", value: "{}", retiredPrefix: "presence:" }]
    });
  });
});
