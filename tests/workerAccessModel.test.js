import { describe, expect, it } from "vitest";
import {
  canCopyActivationLink,
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
});
