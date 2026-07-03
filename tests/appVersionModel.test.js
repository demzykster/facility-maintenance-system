import { describe, expect, it } from "vitest";
import {
  normalizeVersionManifest,
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
});
