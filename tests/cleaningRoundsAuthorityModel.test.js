import { describe, expect, it } from "vitest";
import { cleaningRoundsAuthorityFailureIssue, cleaningRoundsForAuthority, normalizedCleaningRoundsAuthorityEnabled } from "../src/cleaningRoundsAuthorityModel.js";

describe("cleaning rounds authority model", () => {
  it("enables normalized cleaning rounds authority only in production API storage with a provider", () => {
    expect(normalizedCleaningRoundsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedCleaningRoundsAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedCleaningRoundsAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedCleaningRoundsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads cleaning rounds from the normalized provider when authority is enabled", async () => {
    await expect(cleaningRoundsForAuthority({
      kvRounds: [{ id: "kv-round" }],
      provider: { list: () => Promise.resolve({ rounds: [{ id: "round-1" }] }) },
      normalizedAuthority: true
    })).resolves.toEqual({ rounds: [{ id: "round-1" }], source: "normalized" });
  });

  it("keeps KV cleaning rounds as the source outside normalized authority mode", async () => {
    await expect(cleaningRoundsForAuthority({
      kvRounds: [{ id: "kv-round" }],
      provider: { list: () => Promise.resolve({ rounds: [{ id: "round-1" }] }) },
      normalizedAuthority: false
    })).resolves.toEqual({ rounds: [{ id: "kv-round" }], source: "kv" });
  });

  it("creates a consistent automatic issue payload for normalized failures", () => {
    expect(cleaningRoundsAuthorityFailureIssue({ action: "save", id: "round-1", message: "nope" })).toEqual({
      kind: "cleaning_rounds_normalized_save_failed",
      action: "save",
      key: "cround:round-1",
      message: "nope"
    });
  });
});
