import { describe, expect, it, vi } from "vitest";
import {
  normalizedSettingsRecordsAuthorityEnabled,
  settingsRecordsAuthorityFailureIssue,
  settingsRecordsForAuthority
} from "../src/settingsRecordsAuthorityModel.js";

describe("settings records authority model", () => {
  it("enables normalized settings records only for production API provider", () => {
    expect(normalizedSettingsRecordsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedSettingsRecordsAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedSettingsRecordsAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedSettingsRecordsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads locations and app issues from the normalized provider when authority is enabled", async () => {
    const provider = {
      locations: { list: vi.fn().mockResolvedValue({ ok: true, locations: [{ id: "loc-1" }] }) },
      appIssues: { list: vi.fn().mockResolvedValue({ ok: true, appIssues: [{ id: "issue-1" }] }) }
    };

    await expect(settingsRecordsForAuthority({
      kvLocations: [{ id: "kv-loc" }],
      kvAppIssues: [{ id: "kv-issue" }],
      provider,
      normalizedAuthority: true
    })).resolves.toEqual({
      locations: [{ id: "loc-1" }],
      appIssues: [{ id: "issue-1" }],
      source: "normalized"
    });
  });

  it("keeps KV settings records outside normalized authority mode", async () => {
    await expect(settingsRecordsForAuthority({
      kvLocations: [{ id: "kv-loc" }],
      kvAppIssues: [{ id: "kv-issue" }],
      provider: null,
      normalizedAuthority: false
    })).resolves.toEqual({
      locations: [{ id: "kv-loc" }],
      appIssues: [{ id: "kv-issue" }],
      source: "kv"
    });
  });

  it("builds automatic failure issues with useful keys", () => {
    expect(settingsRecordsAuthorityFailureIssue({ action: "load", resource: "appIssues", id: "issue-1", message: "nope" })).toEqual({
      kind: "settings_appIssues_normalized_load_failed",
      action: "load",
      key: "settings:appIssues:issue-1",
      message: "nope"
    });
  });
});
