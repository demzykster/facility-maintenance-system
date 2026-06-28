import { describe, expect, it } from "vitest";
import {
  APP_MODES,
  appModeFromEnv,
  builtinLoginsForMode,
  productionBootstrapAdminContract,
  seedPolicyForMode
} from "../src/seedPolicyModel.js";

describe("seedPolicyModel", () => {
  it("defaults to demo mode when no environment mode is set", () => {
    expect(appModeFromEnv({})).toBe(APP_MODES.demo);
    expect(seedPolicyForMode(appModeFromEnv({}))).toMatchObject({
      allowDemoData: true,
      allowBuiltinDemoUsers: true,
      allowBackupImport: true,
      productionStartsEmpty: false
    });
  });

  it("keeps demo and test modes usable for local/demo work", () => {
    expect(seedPolicyForMode(APP_MODES.demo).allowDemoData).toBe(true);
    expect(seedPolicyForMode(APP_MODES.test).allowBuiltinDemoUsers).toBe(true);
    expect(seedPolicyForMode(APP_MODES.test).allowBackupImport).toBe(true);
  });

  it("disables demo seed and builtin identities in production mode", () => {
    expect(appModeFromEnv({ VITE_CMMS_APP_MODE: "production" })).toBe(APP_MODES.production);
    expect(seedPolicyForMode(APP_MODES.production)).toMatchObject({
      allowDemoData: false,
      allowBuiltinDemoUsers: false,
      allowBackupImport: false,
      requiresServerBootstrapAdmin: true,
      productionStartsEmpty: true
    });
  });

  it("filters builtin logins according to the selected mode", () => {
    const builtins = [{ id: "admin" }, { id: "worker" }];

    expect(builtinLoginsForMode(APP_MODES.demo, builtins)).toEqual(builtins);
    expect(builtinLoginsForMode(APP_MODES.production, builtins)).toEqual([]);
  });

  it("keeps the first production admin contract on the server side", () => {
    expect(productionBootstrapAdminContract(APP_MODES.production)).toEqual({
      required: true,
      location: "server",
      frontendSecretAllowed: false,
      mustForceCredentialChange: true
    });
  });
});
