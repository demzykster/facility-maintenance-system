import { describe, expect, it } from "vitest";
import { activeKvWriteRecords, retiredKvWriteKey, retiredKvWritePrefixes } from "../src/retiredKvWriteModel.js";

describe("retired KV write model", () => {
  it("retires selected compatibility writes only in production API mode", () => {
    expect(retiredKvWritePrefixes({ appMode: "production", storageProvider: "api" })).toEqual([
      "presence:",
      "pushSubscriptions:v1",
      "config:v1",
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
    expect(retiredKvWriteKey("ppeitem:item-1", { appMode: "production", storageProvider: "api" })).toBe("ppeitem:");
    expect(retiredKvWriteKey("ppereq:req-1", { appMode: "production", storageProvider: "api" })).toBe("ppereq:");
    expect(retiredKvWriteKey("ticket:T-1", { appMode: "production", storageProvider: "api" })).toBe("");
  });

  it("separates active and retired batch writes", () => {
    expect(activeKvWriteRecords([
      { key: "presence:user-1", value: "{}" },
      { key: "pushSubscriptions:v1", value: "[]" },
      { key: "config:v1", value: "{}" },
      { key: "ppeitem:item-1", value: "{}" },
      { key: "ticket:T-1", value: "{}" }
    ], { appMode: "production", storageProvider: "api" })).toEqual({
      active: [{ key: "ticket:T-1", value: "{}" }],
      retired: [
        { key: "presence:user-1", value: "{}", retiredPrefix: "presence:" },
        { key: "pushSubscriptions:v1", value: "[]", retiredPrefix: "pushSubscriptions:v1" },
        { key: "config:v1", value: "{}", retiredPrefix: "config:v1" },
        { key: "ppeitem:item-1", value: "{}", retiredPrefix: "ppeitem:" }
      ]
    });
  });
});
