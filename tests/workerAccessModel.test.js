import { describe, expect, it } from "vitest";
import {
  isPasswordActivationRole,
  isPinActivationRole,
  loginSecretKindForRole,
  loginSetupPrompt,
  shouldKeepWorkerFormOpenForActivationLink,
  userHasLoginSecret,
  userNeedsInitialLoginSetup,
  workerLoginStateText
} from "../src/workerAccessModel.js";

describe("worker access model", () => {
  it("classifies login secret kinds by role", () => {
    expect(loginSecretKindForRole("admin")).toBe("password");
    expect(loginSecretKindForRole("user")).toBe("password");
    expect(loginSecretKindForRole("worker")).toBe("pin");
    expect(loginSecretKindForRole("cleaner")).toBe("pin");
    expect(loginSecretKindForRole("tech")).toBe("pin");
    expect(loginSecretKindForRole("supplier")).toBe("");
  });

  it("detects whether a login-capable user already has a secret", () => {
    expect(userHasLoginSecret({ role: "user", password: "123456" })).toBe(true);
    expect(userHasLoginSecret({ role: "user", authUserId: "auth-1" })).toBe(true);
    expect(userHasLoginSecret({ role: "worker", pin: "1234" })).toBe(true);
    expect(userHasLoginSecret({ role: "worker", loginConfigured: true })).toBe(true);
    expect(userHasLoginSecret({ role: "worker", loginState: "active" })).toBe(true);
    expect(userHasLoginSecret({ role: "worker" })).toBe(false);
    expect(userHasLoginSecret({ role: "supplier" })).toBe(false);
  });

  it("requires first-login setup for active users without secrets", () => {
    expect(userNeedsInitialLoginSetup({ role: "user", email: "manager@example.com" })).toBe(true);
    expect(userNeedsInitialLoginSetup({ role: "worker", workerNo: "4010" })).toBe(true);
    expect(userNeedsInitialLoginSetup({ role: "worker", workerNo: "4010", pin: "1234" })).toBe(false);
    expect(userNeedsInitialLoginSetup({ role: "user", email: "manager@example.com", active: false })).toBe(false);
  });

  it("describes configured and not-yet-configured login states without exposing secrets", () => {
    expect(workerLoginStateText({ role: "user", password: "123456" })).toBe("כניסה מוגדרת");
    expect(workerLoginStateText({ role: "worker", pin: "1234" })).toBe("כניסה מוגדרת");
    expect(workerLoginStateText({ role: "user" })).toBe("טרם הוגדרה כניסה");
    expect(workerLoginStateText({ role: "worker" })).toBe("טרם הוגדרה כניסה");
  });

  it("keeps role helpers compatible with existing permission wording", () => {
    expect(isPinActivationRole("worker")).toBe(true);
    expect(isPinActivationRole("cleaner")).toBe(true);
    expect(isPinActivationRole("tech")).toBe(true);
    expect(isPasswordActivationRole("user")).toBe(true);
    expect(isPasswordActivationRole("admin")).toBe(true);
    expect(isPinActivationRole("admin")).toBe(false);
    expect(isPasswordActivationRole("worker")).toBe(false);
  });

  it("does not keep forms open for activation-link copying anymore", () => {
    expect(shouldKeepWorkerFormOpenForActivationLink({ id: "u1", role: "worker" }, true)).toBe(false);
  });

  it("prompts users to set their own first secret by identifier", () => {
    expect(loginSetupPrompt({ role: "user" })).toContain("דוא״ל");
    expect(loginSetupPrompt({ role: "worker" })).toContain("מספר העובד");
    expect(loginSetupPrompt({ role: "tech" })).toContain("מספר הטלפון");
  });
});
