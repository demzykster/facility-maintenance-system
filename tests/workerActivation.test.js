import { describe, expect, it } from "vitest";
import { canCopyActivationLink, shouldKeepWorkerFormOpenForActivationLink, shouldSeedWorkerActivation, workerLoginStateText } from "../src/workerAccessModel.js";

function createActivationLink(user, token) {
  return {
    ...user,
    pin: "",
    activationToken: token,
    activationStatus: "pending"
  };
}

function activateWorker(user, newCode, now = 1_000) {
  return {
    ...user,
    pin: newCode,
    activationToken: "",
    activationStatus: "activated",
    activatedAt: now
  };
}

function applyWorkerLoginFields(originalUser, draft, canManageWorkerAccess) {
  return {
    pin: canManageWorkerAccess ? (draft.pin || "") : (originalUser.pin || ""),
    activationToken: canManageWorkerAccess ? (draft.activationToken || "") : (originalUser.activationToken || ""),
    activationStatus: canManageWorkerAccess
      ? (draft.activationToken ? "pending" : (originalUser.activationStatus || ""))
      : (originalUser.activationStatus || "")
  };
}

describe("worker activation rules", () => {
  it("does not allow copying activation links before the worker is saved", () => {
    const unsavedWorker = createActivationLink({ role: "worker", workerNo: "4010" }, "token-1");
    const savedWorker = { ...unsavedWorker, id: "user-4010" };

    expect(canCopyActivationLink(unsavedWorker, unsavedWorker.activationToken, true)).toBe(false);
    expect(canCopyActivationLink(savedWorker, savedWorker.activationToken, false)).toBe(false);
    expect(canCopyActivationLink(savedWorker, savedWorker.activationToken, true)).toBe(true);
    expect(canCopyActivationLink(savedWorker, "token-not-saved-yet", true)).toBe(false);
  });

  it("keeps saved pending worker forms open so the saved activation link can be copied", () => {
    const savedWorker = createActivationLink({ id: "user-4010", role: "worker", workerNo: "4010" }, "token-1");

    expect(shouldKeepWorkerFormOpenForActivationLink(savedWorker, true)).toBe(true);
    expect(shouldKeepWorkerFormOpenForActivationLink({ ...savedWorker, activationStatus: "activated" }, true)).toBe(false);
    expect(shouldKeepWorkerFormOpenForActivationLink({ ...savedWorker, id: "" }, true)).toBe(false);
    expect(shouldKeepWorkerFormOpenForActivationLink(savedWorker, false)).toBe(false);
  });

  it("tracks pending, activated, temporary-code, and no-access states", () => {
    expect(workerLoginStateText({ role: "worker", activationToken: "t", activationStatus: "pending" })).toBe("ממתין להפעלה");
    expect(workerLoginStateText({ role: "worker", activationStatus: "activated", pin: "9876" })).toBe("הופעל");
    expect(workerLoginStateText({ role: "worker", pin: "1234" })).toBe("קוד זמני");
    expect(workerLoginStateText({ role: "worker" })).toBe("אין כניסה");
  });

  it("resets an activated worker by creating a new pending activation link", () => {
    const activated = activateWorker({ id: "user-1", role: "worker", workerNo: "4010" }, "9876");
    const reset = createActivationLink(activated, "token-2");

    expect(workerLoginStateText(activated)).toBe("הופעל");
    expect(reset.pin).toBe("");
    expect(reset.activationToken).toBe("token-2");
    expect(reset.activationStatus).toBe("pending");
    expect(workerLoginStateText(reset)).toBe("ממתין להפעלה");
  });

  it("seeds activation state for new workers when worker-access permission is available", () => {
    expect(shouldSeedWorkerActivation({ role: "worker" }, "worker", true)).toBe(true);
    expect(shouldSeedWorkerActivation({ role: "cleaner" }, "cleaner", true)).toBe(true);
    expect(shouldSeedWorkerActivation({ role: "worker", pin: "1234" }, "worker", true)).toBe(false);
    expect(shouldSeedWorkerActivation({ id: "user-1", role: "worker" }, "worker", true)).toBe(false);
    expect(shouldSeedWorkerActivation({ role: "worker" }, "worker", false)).toBe(false);
  });

  it("preserves worker login fields when the editor lacks worker access permission", () => {
    const original = {
      id: "user-1",
      role: "worker",
      pin: "1234",
      activationToken: "",
      activationStatus: "activated"
    };
    const attempted = { pin: "9999", activationToken: "new-token" };

    expect(applyWorkerLoginFields(original, attempted, false)).toEqual({
      pin: "1234",
      activationToken: "",
      activationStatus: "activated"
    });
    expect(applyWorkerLoginFields(original, attempted, true)).toEqual({
      pin: "9999",
      activationToken: "new-token",
      activationStatus: "pending"
    });
  });
});
