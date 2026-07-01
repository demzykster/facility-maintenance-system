import { describe, expect, it } from "vitest";
import {
  activeWorkLedgerPolicy,
  extractActiveLedgerBranch,
  extractPinnedMainShas
} from "../src/activeWorkLedgerModel.js";

describe("activeWorkLedgerModel", () => {
  it("extracts an active branch from the live ledger", () => {
    expect(extractActiveLedgerBranch("- Active branch: `codex/example`.\n")).toBe("codex/example");
  });

  it("treats none as no active branch", () => {
    expect(extractActiveLedgerBranch("- Active branch: none.\n")).toBe(null);
  });

  it("extracts pinned main shas from legacy ledger text", () => {
    expect(extractPinnedMainShas("Latest work. Main is currently at `63bc69b`.\n- Current main: fc4fbad")).toEqual([
      "63bc69b",
      "fc4fbad"
    ]);
  });

  it("fails when clean main still points at an active feature branch", () => {
    const result = activeWorkLedgerPolicy({
      content: "- Active branch: `codex/old-work`.\n",
      currentBranch: "main",
      headSha: "fc4fbad",
      originMainSha: "fc4fbad",
      statusShort: ""
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("active_work_points_to_branch_on_main:codex/old-work");
    expect(result.errors).toContain("active_work_claims_unmerged_branch_but_main_is_clean");
  });

  it("fails when the ledger active branch does not match the current feature branch", () => {
    const result = activeWorkLedgerPolicy({
      content: "- Active branch: `codex/old-work`.\n",
      currentBranch: "codex/new-work",
      headSha: "1111111",
      originMainSha: "fc4fbad",
      statusShort: " M docs/active-work.md"
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("active_work_branch_mismatch:codex/old-work!=codex/new-work");
  });

  it("fails on stale pinned main shas", () => {
    const result = activeWorkLedgerPolicy({
      content: "- Active branch: none.\n- Latest completed work: Main is currently at `63bc69b`.\n",
      currentBranch: "main",
      headSha: "fc4fbad",
      originMainSha: "fc4fbad",
      statusShort: ""
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("active_work_pins_stale_main:63bc69b!=fc4fbad");
  });

  it("allows a clean main ledger with no active branch and current main pin", () => {
    const result = activeWorkLedgerPolicy({
      content: "- Active branch: none.\n- Current main: `fc4fbad`.\n",
      currentBranch: "main",
      headSha: "fc4fbad",
      originMainSha: "fc4fbad",
      statusShort: ""
    });

    expect(result).toMatchObject({ ok: true, errors: [] });
  });
});
