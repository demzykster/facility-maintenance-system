import { describe, expect, it, vi } from "vitest";
import { normalizedPresenceAuthorityEnabled, presenceAuthorityFailureIssue, presenceForAuthority } from "../src/presenceAuthorityModel.js";

describe("presence authority model", () => {
  it("enables normalized presence authority only for production API provider", () => {
    expect(normalizedPresenceAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedPresenceAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedPresenceAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedPresenceAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("falls back to KV rows when normalized authority is disabled", async () => {
    await expect(presenceForAuthority({
      kvPresence: [{ id: "user-1" }],
      normalizedAuthority: false
    })).resolves.toEqual({
      presence: [{ id: "user-1" }],
      source: "kv"
    });
  });

  it("loads presence from the normalized provider", async () => {
    const provider = { list: vi.fn().mockResolvedValue({ presence: [{ id: "user-1" }] }) };

    await expect(presenceForAuthority({ provider, normalizedAuthority: true })).resolves.toEqual({
      presence: [{ id: "user-1" }],
      source: "normalized"
    });
  });

  it("builds failure issues for automatic reporting", () => {
    expect(presenceAuthorityFailureIssue({ action: "save", id: "user-1", message: "boom" })).toEqual({
      kind: "presence_normalized_save_failed",
      action: "save",
      key: "presence:user-1",
      message: "boom"
    });
  });
});
