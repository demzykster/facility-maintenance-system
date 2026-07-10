import { describe, expect, it } from "vitest";
import { activeKvWriteRecords, retiredKvWriteKey, retiredKvWritePrefixes } from "../src/retiredKvWriteModel.js";

describe("retired KV write model", () => {
  it("retires selected compatibility writes only in production API mode", () => {
    expect(retiredKvWritePrefixes({ appMode: "production", storageProvider: "api" })).toEqual([
      "presence:",
      "pushSubscriptions:v1",
      "config:v1",
      "user:",
      "ticket:",
      "fleet:",
      "pm:",
      "mtask:",
      "mmeet:",
      "czone:",
      "cround:",
      "ccomplaint:",
      "cabsence:",
      "ppe:",
      "ppeitem:",
      "ppenorm:",
      "ppereq:",
      "ppeorder:"
    ]);
    expect(retiredKvWritePrefixes({ appMode: "demo", storageProvider: "api" })).toEqual([]);
    expect(retiredKvWriteKey("presence:user-1", { appMode: "production", storageProvider: "api" })).toBe("presence:");
    expect(retiredKvWriteKey("pushSubscriptions:v1", { appMode: "production", storageProvider: "api" })).toBe("pushSubscriptions:v1");
    expect(retiredKvWriteKey("config:v1", { appMode: "production", storageProvider: "api" })).toBe("config:v1");
    expect(retiredKvWriteKey("user:worker-1", { appMode: "production", storageProvider: "api" })).toBe("user:");
    expect(retiredKvWriteKey("ticket:T-1", { appMode: "production", storageProvider: "api" })).toBe("ticket:");
    expect(retiredKvWriteKey("fleet:F-1", { appMode: "production", storageProvider: "api" })).toBe("fleet:");
    expect(retiredKvWriteKey("pm:PM-1", { appMode: "production", storageProvider: "api" })).toBe("pm:");
    expect(retiredKvWriteKey("mtask:task-1", { appMode: "production", storageProvider: "api" })).toBe("mtask:");
    expect(retiredKvWriteKey("mmeet:meet-1", { appMode: "production", storageProvider: "api" })).toBe("mmeet:");
    expect(retiredKvWriteKey("czone:zone-1", { appMode: "production", storageProvider: "api" })).toBe("czone:");
    expect(retiredKvWriteKey("cround:round-1", { appMode: "production", storageProvider: "api" })).toBe("cround:");
    expect(retiredKvWriteKey("ppeitem:item-1", { appMode: "production", storageProvider: "api" })).toBe("ppeitem:");
    expect(retiredKvWriteKey("ppereq:req-1", { appMode: "production", storageProvider: "api" })).toBe("ppereq:");
  });

  it("separates active and retired batch writes", () => {
    expect(activeKvWriteRecords([
      { key: "presence:user-1", value: "{}" },
      { key: "pushSubscriptions:v1", value: "[]" },
      { key: "config:v1", value: "{}" },
      { key: "user:worker-1", value: "{}" },
      { key: "ticket:T-1", value: "{}" },
      { key: "fleet:F-1", value: "{}" },
      { key: "pm:PM-1", value: "{}" },
      { key: "mtask:task-1", value: "{}" },
      { key: "mmeet:meet-1", value: "{}" },
      { key: "czone:zone-1", value: "{}" },
      { key: "ppeitem:item-1", value: "{}" },
      { key: "location:loc-1", value: "{}" }
    ], { appMode: "production", storageProvider: "api" })).toEqual({
      active: [{ key: "location:loc-1", value: "{}" }],
      retired: [
        { key: "presence:user-1", value: "{}", retiredPrefix: "presence:" },
        { key: "pushSubscriptions:v1", value: "[]", retiredPrefix: "pushSubscriptions:v1" },
        { key: "config:v1", value: "{}", retiredPrefix: "config:v1" },
        { key: "user:worker-1", value: "{}", retiredPrefix: "user:" },
        { key: "ticket:T-1", value: "{}", retiredPrefix: "ticket:" },
        { key: "fleet:F-1", value: "{}", retiredPrefix: "fleet:" },
        { key: "pm:PM-1", value: "{}", retiredPrefix: "pm:" },
        { key: "mtask:task-1", value: "{}", retiredPrefix: "mtask:" },
        { key: "mmeet:meet-1", value: "{}", retiredPrefix: "mmeet:" },
        { key: "czone:zone-1", value: "{}", retiredPrefix: "czone:" },
        { key: "ppeitem:item-1", value: "{}", retiredPrefix: "ppeitem:" }
      ]
    });
  });
});
