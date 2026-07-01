import { describe, expect, it } from "vitest";
import {
  activationTokenForSave,
  canCopyActivationLink,
  canCreateActivationLinkForSavedUser,
  shouldKeepWorkerFormOpenForActivationLink,
  shouldSeedWorkerActivation,
  workerLoginStateText
} from "../src/workerAccessModel.js";

describe("worker access model", () => {
  it("seeds activation links for every new login-capable role when access can be managed", () => {
    for (const role of ["admin", "user", "tech", "worker", "cleaner"]) {
      expect(shouldSeedWorkerActivation({}, role, true)).toBe(true);
    }
  });

  it("does not seed an activation link over an existing secret or activation state", () => {
    expect(shouldSeedWorkerActivation({ pin: "1234" }, "worker", true)).toBe(false);
    expect(shouldSeedWorkerActivation({ password: "123456" }, "user", true)).toBe(false);
    expect(shouldSeedWorkerActivation({ activationToken: "tok" }, "cleaner", true)).toBe(false);
    expect(shouldSeedWorkerActivation({ activationStatus: "activated" }, "tech", true)).toBe(false);
  });

  it("keeps the form open only after a saved pending activation link can be copied", () => {
    const pendingUser = { id: "u1", role: "user", activationToken: "tok", activationStatus: "pending" };

    expect(shouldKeepWorkerFormOpenForActivationLink(pendingUser, true)).toBe(true);
    expect(canCopyActivationLink(pendingUser, "tok", true)).toBe(true);
    expect(canCopyActivationLink(pendingUser, "other", true)).toBe(false);
  });

  it("describes pending and activated login states without exposing secrets", () => {
    expect(workerLoginStateText({ role: "user", activationToken: "tok", activationStatus: "pending" })).toBe("ממתין להפעלה");
    expect(workerLoginStateText({ role: "worker", activationStatus: "activated" })).toBe("הופעל");
  });

  it("creates an activation token during save when a login-capable user has no secret yet", () => {
    expect(activationTokenForSave({
      user: {},
      role: "user",
      canManageWorkerAccess: true,
      createToken: () => "new-token"
    })).toBe("new-token");
  });

  it("does not create a new token over activated or legacy-secret users", () => {
    expect(activationTokenForSave({
      user: { activationStatus: "activated" },
      role: "user",
      canManageWorkerAccess: true,
      createToken: () => "new-token"
    })).toBe("");
    expect(activationTokenForSave({
      user: { pin: "1234" },
      role: "worker",
      canManageWorkerAccess: true,
      createToken: () => "new-token"
    })).toBe("");
  });

  it("allows creating activation links for saved users that were created without login setup", () => {
    expect(canCreateActivationLinkForSavedUser({
      id: "worker-1",
      role: "worker",
      workerNo: "4010"
    }, "worker", "", true)).toBe(true);
    expect(canCreateActivationLinkForSavedUser({
      id: "manager-1",
      role: "user",
      email: "manager@example.com"
    }, "user", "", true)).toBe(true);
  });

  it("does not show saved-user activation creation for unsaved, pending, activated, or legacy-secret users", () => {
    expect(canCreateActivationLinkForSavedUser({ role: "worker" }, "worker", "", true)).toBe(false);
    expect(canCreateActivationLinkForSavedUser({ id: "worker-1", role: "worker" }, "worker", "token-1", true)).toBe(false);
    expect(canCreateActivationLinkForSavedUser({ id: "worker-1", role: "worker", activationStatus: "activated" }, "worker", "", true)).toBe(false);
    expect(canCreateActivationLinkForSavedUser({ id: "worker-1", role: "worker", pin: "1234" }, "worker", "", true)).toBe(false);
    expect(canCreateActivationLinkForSavedUser({ id: "manager-1", role: "user", password: "123456" }, "user", "", true)).toBe(false);
    expect(canCreateActivationLinkForSavedUser({ id: "worker-1", role: "worker" }, "worker", "", false)).toBe(false);
  });
});
