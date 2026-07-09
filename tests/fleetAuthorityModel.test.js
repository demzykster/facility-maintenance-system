import { describe, expect, it, vi } from "vitest";
import { fleetAuthorityFailureIssue, fleetForAuthority, normalizedFleetAuthorityEnabled } from "../src/fleetAuthorityModel.js";

describe("fleetAuthorityModel", () => {
  it("enables normalized fleet authority only in production API storage with a provider", () => {
    expect(normalizedFleetAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedFleetAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedFleetAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedFleetAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads fleet units from the normalized provider when authority is enabled", async () => {
    const provider = { list: vi.fn().mockResolvedValue({ ok: true, units: [{ id: "F-1" }] }) };

    await expect(fleetForAuthority({
      kvFleet: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: true
    })).resolves.toEqual({ fleet: [{ id: "F-1" }], source: "normalized" });
  });

  it("keeps KV fleet units as the source outside normalized authority mode", async () => {
    const provider = { list: vi.fn() };

    await expect(fleetForAuthority({
      kvFleet: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: false
    })).resolves.toEqual({ fleet: [{ id: "KV-1" }], source: "kv" });
    expect(provider.list).not.toHaveBeenCalled();
  });

  it("creates a consistent automatic issue payload for normalized failures", () => {
    expect(fleetAuthorityFailureIssue({ action: "save", id: "F-1", message: "nope" })).toEqual({
      kind: "fleet_normalized_save_failed",
      action: "save",
      key: "fleet:F-1",
      message: "nope"
    });
  });
});
