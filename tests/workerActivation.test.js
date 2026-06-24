import { describe, expect, it } from "vitest";

function workerLoginStateText(user) {
  if (!user || (user.role !== "worker" && user.role !== "cleaner")) return "";
  if (user.activationToken && user.activationStatus === "pending") return "pending activation";
  if (user.activationStatus === "activated") return "activated";
  if (user.pin) return "temporary code";
  return "no access";
}

function canCopyActivationLink(user, canManageWorkerAccess) {
  return !!user.id && !!user.activationToken && !!canManageWorkerAccess;
}

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

    expect(canCopyActivationLink(unsavedWorker, true)).toBe(false);
    expect(canCopyActivationLink(savedWorker, false)).toBe(false);
    expect(canCopyActivationLink(savedWorker, true)).toBe(true);
  });

  it("tracks pending, activated, temporary-code, and no-access states", () => {
    expect(workerLoginStateText({ role: "worker", activationToken: "t", activationStatus: "pending" })).toBe("pending activation");
    expect(workerLoginStateText({ role: "worker", activationStatus: "activated", pin: "9876" })).toBe("activated");
    expect(workerLoginStateText({ role: "worker", pin: "1234" })).toBe("temporary code");
    expect(workerLoginStateText({ role: "worker" })).toBe("no access");
  });

  it("resets an activated worker by creating a new pending activation link", () => {
    const activated = activateWorker({ id: "user-1", role: "worker", workerNo: "4010" }, "9876");
    const reset = createActivationLink(activated, "token-2");

    expect(workerLoginStateText(activated)).toBe("activated");
    expect(reset.pin).toBe("");
    expect(reset.activationToken).toBe("token-2");
    expect(reset.activationStatus).toBe("pending");
    expect(workerLoginStateText(reset)).toBe("pending activation");
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
