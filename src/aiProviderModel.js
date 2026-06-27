export const AI_MODES = Object.freeze({
  client: "client",
  disabled: "disabled",
  server: "server"
});

export function aiModeFromEnv(env = {}, appMode = "demo") {
  const raw = String(env.VITE_CMMS_AI_MODE || env.CMMS_AI_MODE || "").trim().toLowerCase();
  if (Object.values(AI_MODES).includes(raw)) return raw;
  return appMode === "production" ? AI_MODES.disabled : AI_MODES.client;
}

export function aiServerConfigFromEnv(env = {}) {
  return {
    mode: aiModeFromEnv(env, String(env.VITE_CMMS_APP_MODE || "demo").trim().toLowerCase()),
    provider: String(env.CMMS_AI_PROVIDER || "").trim().toLowerCase(),
    anthropicApiKey: String(env.ANTHROPIC_API_KEY || "").trim()
  };
}

export function productionAiPolicy({ appMode = "demo", ai = {} } = {}) {
  const production = appMode === "production";
  const mode = Object.values(AI_MODES).includes(ai.mode) ? ai.mode : (production ? AI_MODES.disabled : AI_MODES.client);
  const errors = [];

  if (production && mode === AI_MODES.client) {
    errors.push("production_forbids_browser_ai_provider_calls");
  }
  if (production && mode === AI_MODES.server) {
    if (ai.provider !== "anthropic") errors.push("production_requires_ai_provider");
    if (!ai.anthropicApiKey) errors.push("production_requires_anthropic_api_key");
  }

  return {
    mode,
    ok: errors.length === 0,
    errors
  };
}
