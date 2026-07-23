import { describe, expect, it } from "vitest";
import {
  canShowFirstRunInstallForm,
  firstRunInstallStateKind,
  shouldRedirectLoginToInstall
} from "../src/firstRunInstallStateModel.js";

describe("first-run install state model", () => {
  it("redirects login to install only for server-confirmed NEW state", () => {
    expect(shouldRedirectLoginToInstall({ ok: true, state: "new" })).toBe(true);
    expect(shouldRedirectLoginToInstall({ ok: true, state: "ready" })).toBe(false);
    expect(shouldRedirectLoginToInstall({ ok: true, state: "admin_recovery_required" })).toBe(false);
    expect(shouldRedirectLoginToInstall({ ok: false, state: "unknown" })).toBe(false);
  });

  it("shows the first-run form only for server-confirmed NEW state", () => {
    expect(canShowFirstRunInstallForm({ ok: true, state: "new" })).toBe(true);
    expect(canShowFirstRunInstallForm({ ok: true, state: "blocked", reason: "install_in_progress" })).toBe(false);
    expect(canShowFirstRunInstallForm({ ok: true, state: "admin_recovery_required" })).toBe(false);
    expect(canShowFirstRunInstallForm(null)).toBe(false);
  });

  it("keeps recovery-required distinct from install-in-progress and state-check failures", () => {
    expect(firstRunInstallStateKind({ ok: true, state: "admin_recovery_required" })).toBe("admin_recovery_required");
    expect(firstRunInstallStateKind({ ok: true, state: "blocked", reason: "install_in_progress" })).toBe("install_in_progress");
    expect(firstRunInstallStateKind({ ok: false, state: "unknown" })).toBe("state_check_failed");
    expect(firstRunInstallStateKind(null)).toBe("checking");
  });
});
