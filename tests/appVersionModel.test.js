import { describe, expect, it } from "vitest";
import {
  markStandaloneVersionRefreshed,
  normalizeVersionManifest,
  pwaRefreshStorageKey,
  shouldAutoRefreshStandaloneVersion,
  shouldShowVersionUpdate
} from "../src/appVersionModel.js";

describe("app version model", () => {
  it("shows an update only when the deployed commit differs from the open tab", () => {
    expect(shouldShowVersionUpdate({ currentCommit: "abc1234", latestCommit: "def5678" })).toBe(true);
    expect(shouldShowVersionUpdate({ currentCommit: "abc1234", latestCommit: "abc1234" })).toBe(false);
  });

  it("does not show update prompts for local or unknown builds", () => {
    expect(shouldShowVersionUpdate({ currentCommit: "local", latestCommit: "def5678" })).toBe(false);
    expect(shouldShowVersionUpdate({ currentCommit: "abc1234", latestCommit: "unknown" })).toBe(false);
  });

  it("respects a dismissed latest commit", () => {
    expect(shouldShowVersionUpdate({
      currentCommit: "abc1234",
      latestCommit: "def5678",
      dismissedCommit: "def5678"
    })).toBe(false);
  });

  it("normalizes the public version manifest to safe strings", () => {
    expect(normalizeVersionManifest({
      commit: "abcdef1234567890",
      buildTime: "2026-06-29T18:00:00.000Z",
      version: "0.1.0"
    })).toEqual({
      commit: "abcdef1234567890",
      buildTime: "2026-06-29T18:00:00.000Z",
      version: "0.1.0"
    });
  });

  it("auto-refreshes stale standalone builds only once per deployed commit", () => {
    const storage = new Map();
    const store = {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value)
    };

    expect(shouldAutoRefreshStandaloneVersion({
      currentCommit: "abc1234",
      latestCommit: "def5678",
      isStandalone: true,
      storage: store
    })).toBe(true);

    expect(markStandaloneVersionRefreshed({ latestCommit: "def5678", storage: store })).toBe(true);
    expect(storage.get(pwaRefreshStorageKey("def5678"))).toBe("1");
    expect(shouldAutoRefreshStandaloneVersion({
      currentCommit: "abc1234",
      latestCommit: "def5678",
      isStandalone: true,
      storage: store
    })).toBe(false);
  });

  it("does not auto-refresh normal browser tabs", () => {
    expect(shouldAutoRefreshStandaloneVersion({
      currentCommit: "abc1234",
      latestCommit: "def5678",
      isStandalone: false,
      storage: new Map()
    })).toBe(false);
  });
});
