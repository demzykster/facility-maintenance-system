import { describe, expect, it, vi } from "vitest";
import { normalizedPmAuthorityEnabled, pmAuthorityFailureIssue, pmForAuthority } from "../src/pmAuthorityModel.js";

describe("pmAuthorityModel", () => {
  it("enables normalized PM authority only in production API storage with a provider", () => {
    expect(normalizedPmAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedPmAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedPmAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedPmAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads PM tasks from the normalized provider when authority is enabled", async () => {
    const provider = { list: vi.fn().mockResolvedValue({ ok: true, tasks: [{ id: "pm-1" }] }) };

    await expect(pmForAuthority({
      kvPm: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: true
    })).resolves.toEqual({ pm: [{ id: "pm-1" }], source: "normalized" });
  });

  it("keeps KV PM tasks as the source outside normalized authority mode", async () => {
    const provider = { list: vi.fn() };

    await expect(pmForAuthority({
      kvPm: [{ id: "KV-1" }],
      provider,
      normalizedAuthority: false
    })).resolves.toEqual({ pm: [{ id: "KV-1" }], source: "kv" });
    expect(provider.list).not.toHaveBeenCalled();
  });

  it("creates a consistent automatic issue payload for normalized failures", () => {
    expect(pmAuthorityFailureIssue({ action: "save", id: "pm-1", message: "nope" })).toEqual({
      kind: "pm_normalized_save_failed",
      action: "save",
      key: "pm:pm-1",
      message: "nope"
    });
  });
});
