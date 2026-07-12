export const AI_MODES = Object.freeze({
  client: "client",
  disabled: "disabled",
  server: "server"
});

export const AI_PROVIDERS = Object.freeze({
  anthropic: "anthropic",
  openai: "openai"
});

export const DEFAULT_AI_MODELS = Object.freeze({
  [AI_PROVIDERS.anthropic]: "claude-sonnet-4-20250514",
  [AI_PROVIDERS.openai]: "gpt-5.2"
});

export function aiModeFromEnv(env = {}, appMode = "demo") {
  const raw = String(env.VITE_CMMS_AI_MODE || env.CMMS_AI_MODE || "").trim().toLowerCase();
  if (raw === AI_MODES.client) return AI_MODES.disabled;
  if (Object.values(AI_MODES).includes(raw)) return raw;
  return AI_MODES.disabled;
}

export function normalizeAiProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return Object.values(AI_PROVIDERS).includes(provider) ? provider : "";
}

export function aiServerConfigFromEnv(env = {}) {
  const provider = normalizeAiProvider(env.CMMS_AI_PROVIDER);
  return {
    mode: aiModeFromEnv(env, String(env.VITE_CMMS_APP_MODE || "demo").trim().toLowerCase()),
    provider,
    model: String(env.CMMS_AI_MODEL || DEFAULT_AI_MODELS[provider] || "").trim(),
    anthropicApiKey: String(env.ANTHROPIC_API_KEY || "").trim(),
    openaiApiKey: String(env.OPENAI_API_KEY || "").trim()
  };
}

export function productionAiPolicy({ appMode = "demo", ai = {} } = {}) {
  const production = appMode === "production";
  const mode = Object.values(AI_MODES).includes(ai.mode) ? ai.mode : AI_MODES.disabled;
  const provider = normalizeAiProvider(ai.provider);
  const errors = [];

  if (production && mode === AI_MODES.client) {
    errors.push("production_forbids_browser_ai_provider_calls");
  }
  if (production && mode === AI_MODES.server) {
    if (!provider) errors.push("production_requires_ai_provider");
    if (provider === AI_PROVIDERS.anthropic && !ai.anthropicApiKey) errors.push("production_requires_anthropic_api_key");
    if (provider === AI_PROVIDERS.openai && !ai.openaiApiKey) errors.push("production_requires_openai_api_key");
  }

  return {
    mode,
    provider,
    ok: errors.length === 0,
    errors
  };
}
