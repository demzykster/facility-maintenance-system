export const APP_MODES = Object.freeze({
  demo: "demo",
  production: "production",
  test: "test"
});

export function appModeFromEnv(env = {}) {
  const value = String(env?.VITE_CMMS_APP_MODE || "").trim().toLowerCase();
  return Object.values(APP_MODES).includes(value) ? value : APP_MODES.demo;
}

export function seedPolicyForMode(mode) {
  const normalized = Object.values(APP_MODES).includes(mode) ? mode : APP_MODES.demo;
  const production = normalized === APP_MODES.production;
  return {
    mode: normalized,
    allowDemoData: !production,
    allowBuiltinDemoUsers: !production,
    allowBackupImport: !production,
    requiresServerBootstrapAdmin: production,
    productionStartsEmpty: production
  };
}

export function builtinLoginsForMode(mode, builtins = []) {
  return seedPolicyForMode(mode).allowBuiltinDemoUsers ? builtins : [];
}

export function productionBootstrapAdminContract(mode) {
  const policy = seedPolicyForMode(mode);
  return {
    required: policy.requiresServerBootstrapAdmin,
    location: policy.requiresServerBootstrapAdmin ? "server" : "demo",
    frontendSecretAllowed: false,
    mustForceCredentialChange: policy.requiresServerBootstrapAdmin
  };
}
