export const AI_MODES = Object.freeze({
  client: "client",
  disabled: "disabled",
  server: "server"
});

export const AI_PROVIDERS = Object.freeze({
  anthropic: "anthropic",
  openai: "openai"
});

export const AI_PROVIDER_LABELS = Object.freeze({
  [AI_PROVIDERS.anthropic]: "Claude / Anthropic",
  [AI_PROVIDERS.openai]: "OpenAI / Codex-compatible"
});

export const AI_PROVIDER_ALIASES = Object.freeze({
  anthropic: AI_PROVIDERS.anthropic,
  claude: AI_PROVIDERS.anthropic,
  openai: AI_PROVIDERS.openai,
  codex: AI_PROVIDERS.openai,
  chatgpt: AI_PROVIDERS.openai,
  gpt: AI_PROVIDERS.openai
});

export const DEFAULT_AI_MODELS = Object.freeze({
  [AI_PROVIDERS.anthropic]: "claude-sonnet-4-20250514",
  [AI_PROVIDERS.openai]: "gpt-5.2"
});

export const AI_PROVIDER_OPTIONS = Object.freeze(Object.values(AI_PROVIDERS).map((id) => Object.freeze({
  id,
  label: AI_PROVIDER_LABELS[id],
  defaultModel: DEFAULT_AI_MODELS[id]
})));

export const AI_SETTING_MODES = Object.freeze({
  disabled: AI_MODES.disabled,
  server: AI_MODES.server
});

export function aiModeFromEnv(env = {}, appMode = "demo") {
  const raw = String(env.VITE_CMMS_AI_MODE || env.CMMS_AI_MODE || "").trim().toLowerCase();
  if (raw === AI_MODES.client) return AI_MODES.disabled;
  if (Object.values(AI_MODES).includes(raw)) return raw;
  return AI_MODES.disabled;
}

export function normalizeAiProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return AI_PROVIDER_ALIASES[provider] || "";
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

export function normalizeAiSettings(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const mode = Object.values(AI_SETTING_MODES).includes(input.mode) ? input.mode : AI_MODES.disabled;
  const provider = normalizeAiProvider(input.provider);
  const model = provider ? String(input.model || DEFAULT_AI_MODELS[provider] || "").trim() : "";
  return {
    mode,
    provider,
    model
  };
}

export function publicAiServerStatusFromEnv(env = {}) {
  const config = aiServerConfigFromEnv(env);
  const providerKeyConfigured = (
    (config.provider === AI_PROVIDERS.anthropic && !!config.anthropicApiKey)
    || (config.provider === AI_PROVIDERS.openai && !!config.openaiApiKey)
  );
  const errors = [];
  if (config.mode !== AI_MODES.server) errors.push("ai_server_disabled");
  if (config.mode === AI_MODES.server && !config.provider) errors.push("ai_provider_required");
  if (config.mode === AI_MODES.server && config.provider && !providerKeyConfigured) errors.push("ai_provider_key_required");

  return {
    mode: config.mode,
    provider: config.provider,
    model: config.model,
    providerKeyConfigured,
    serverReady: config.mode === AI_MODES.server && !!config.provider && providerKeyConfigured,
    supportedProviders: Object.values(AI_PROVIDERS),
    supportedProviderOptions: AI_PROVIDER_OPTIONS,
    defaultModels: DEFAULT_AI_MODELS,
    errors
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
