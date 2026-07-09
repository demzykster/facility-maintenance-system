import { describe, expect, it } from "vitest";
import { cleaningZonesAuthorityFailureIssue, cleaningZonesForAuthority, normalizedCleaningZonesAuthorityEnabled } from "../src/cleaningZonesAuthorityModel.js";

describe("cleaning zones authority model", () => {
  it("enables normalized cleaning zones authority only in production API storage with a provider", () => {
    expect(normalizedCleaningZonesAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedCleaningZonesAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedCleaningZonesAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedCleaningZonesAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads cleaning zones from the normalized provider when authority is enabled", async () => {
    await expect(cleaningZonesForAuthority({
      kvZones: [{ id: "kv-zone" }],
      provider: { list: () => Promise.resolve({ zones: [{ id: "zone-1" }] }) },
      normalizedAuthority: true
    })).resolves.toEqual({ zones: [{ id: "zone-1" }], source: "normalized" });
  });

  it("keeps KV cleaning zones as the source outside normalized authority mode", async () => {
    await expect(cleaningZonesForAuthority({
      kvZones: [{ id: "kv-zone" }],
      provider: { list: () => Promise.resolve({ zones: [{ id: "zone-1" }] }) },
      normalizedAuthority: false
    })).resolves.toEqual({ zones: [{ id: "kv-zone" }], source: "kv" });
  });

  it("creates a consistent automatic issue payload for normalized failures", () => {
    expect(cleaningZonesAuthorityFailureIssue({ action: "save", id: "zone-1", message: "nope" })).toEqual({
      kind: "cleaning_zones_normalized_save_failed",
      action: "save",
      key: "czone:zone-1",
      message: "nope"
    });
  });
});
