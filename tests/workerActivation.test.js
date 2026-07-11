import { describe, expect, it } from "vitest";
import { isPasswordActivationRole, isPinActivationRole, userHasLoginSecret, userNeedsInitialLoginSetup, workerLoginStateText } from "../src/workerAccessModel.js";

function applyWorkerLoginFields(originalUser, draft, canManageWorkerAccess) {
  return {
    pin: canManageWorkerAccess ? (draft.pin || "") : (originalUser.pin || ""),
    activationToken: "",
    activationStatus: canManageWorkerAccess
      ? ((draft.pin || draft.password || originalUser.authUserId) ? "activated" : "")
      : (originalUser.activationStatus || "")
  };
}

describe("first-login credential rules", () => {
  it("new login-capable users are saved without generated secrets or links", () => {
    const newWorker = { role: "worker", workerNo: "4010", pin: "", activationToken: "", activationStatus: "" };
    const newManager = { role: "user", email: "manager@example.com", password: "", activationToken: "", activationStatus: "" };
    const newExecutive = { role: "executive", email: "leadership@example.com", password: "", activationToken: "", activationStatus: "" };

    expect(userNeedsInitialLoginSetup(newWorker)).toBe(true);
    expect(userNeedsInitialLoginSetup(newManager)).toBe(true);
    expect(userNeedsInitialLoginSetup(newExecutive)).toBe(true);
    expect(userHasLoginSecret(newWorker)).toBe(false);
    expect(userHasLoginSecret(newManager)).toBe(false);
    expect(userHasLoginSecret(newExecutive)).toBe(false);
  });

  it("marks users as configured only after they set their own password or PIN", () => {
    const worker = { role: "worker", workerNo: "4010", pin: "9876", activationStatus: "activated" };
    const manager = { role: "user", email: "manager@example.com", password: "secret1", activationStatus: "activated" };

    expect(workerLoginStateText(worker)).toBe("כניסה מוגדרת");
    expect(workerLoginStateText(manager)).toBe("כניסה מוגדרת");
    expect(userNeedsInitialLoginSetup(worker)).toBe(false);
    expect(userNeedsInitialLoginSetup(manager)).toBe(false);
  });

  it("classifies PIN and password roles", () => {
    expect(isPinActivationRole("worker")).toBe(true);
    expect(isPinActivationRole("cleaner")).toBe(true);
    expect(isPinActivationRole("tech")).toBe(true);
    expect(isPasswordActivationRole("user")).toBe(true);
    expect(isPasswordActivationRole("executive")).toBe(true);
    expect(isPasswordActivationRole("admin")).toBe(true);
    expect(isPinActivationRole("admin")).toBe(false);
    expect(isPinActivationRole("executive")).toBe(false);
    expect(isPasswordActivationRole("worker")).toBe(false);
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
      activationToken: "",
      activationStatus: "activated"
    });
  });
});
