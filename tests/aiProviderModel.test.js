import { describe, expect, it } from "vitest";
import { AI_MODES, AI_PROVIDER_LABELS, AI_PROVIDER_OPTIONS, AI_PROVIDERS, aiModeFromEnv, aiServerConfigFromEnv, normalizeAiProvider, normalizeAiSettings, productionAiPolicy, publicAiServerStatusFromEnv } from "../src/aiProviderModel.js";

describe("aiProviderModel", () => {
  it("disables browser AI by default and ignores the legacy client mode", () => {
    expect(aiModeFromEnv({}, "demo")).toBe(AI_MODES.disabled);
    expect(aiModeFromEnv({}, "production")).toBe(AI_MODES.disabled);
    expect(aiModeFromEnv({ VITE_CMMS_AI_MODE: "client" }, "demo")).toBe(AI_MODES.disabled);
  });

  it("blocks direct browser provider calls in production", () => {
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "client" }
    })).toMatchObject({
      ok: false,
      errors: ["production_forbids_browser_ai_provider_calls"]
    });
  });

  it("allows disabled production AI and validates server AI requirements", () => {
    expect(productionAiPolicy({ appMode: "production", ai: { mode: "disabled" } })).toMatchObject({
      ok: true,
      errors: []
    });
    expect(productionAiPolicy({ appMode: "production", ai: { mode: "server" } })).toMatchObject({
      ok: false,
      errors: ["production_requires_ai_provider"]
    });
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "anthropic", anthropicApiKey: "secret" }
    })).toMatchObject({
      ok: true,
      provider: AI_PROVIDERS.anthropic,
      errors: []
    });
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "openai" }
    })).toMatchObject({
      ok: false,
      provider: AI_PROVIDERS.openai,
      errors: ["production_requires_openai_api_key"]
    });
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "openai", openaiApiKey: "secret" }
    })).toMatchObject({
      ok: true,
      provider: AI_PROVIDERS.openai,
      errors: []
    });
  });

  it("normalizes server provider configuration without exposing browser AI", () => {
    expect(normalizeAiProvider(" OPENAI ")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("codex")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("chatgpt")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("claude")).toBe(AI_PROVIDERS.anthropic);
    expect(normalizeAiProvider("unknown")).toBe("");
    expect(aiServerConfigFromEnv({
      VITE_CMMS_APP_MODE: "production",
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "codex",
      OPENAI_API_KEY: "sk-test"
    })).toMatchObject({
      mode: AI_MODES.server,
      provider: AI_PROVIDERS.openai,
      model: "gpt-5.2",
      openaiApiKey: "sk-test"
    });
  });

  it("normalizes browser-safe AI settings and server readiness status", () => {
    expect(normalizeAiSettings({ mode: "client", provider: "codex", model: "x" })).toEqual({
      mode: AI_MODES.disabled,
      provider: AI_PROVIDERS.openai,
      model: "x"
    });
    expect(normalizeAiSettings({ mode: "server", provider: "openai" })).toEqual({
      mode: AI_MODES.server,
      provider: AI_PROVIDERS.openai,
      model: "gpt-5.2"
    });

    expect(publicAiServerStatusFromEnv({
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "server-secret"
    })).toMatchObject({
      mode: AI_MODES.server,
      provider: AI_PROVIDERS.anthropic,
      model: "claude-sonnet-4-20250514",
      providerKeyConfigured: true,
      serverReady: true,
      supportedProviderOptions: AI_PROVIDER_OPTIONS,
      errors: []
    });
    expect(AI_PROVIDER_LABELS[AI_PROVIDERS.openai]).toContain("Codex");
    const disabled = publicAiServerStatusFromEnv({
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "openai"
    });
    expect(disabled.serverReady).toBe(false);
    expect(disabled.errors).toContain("ai_provider_key_required");
    expect(JSON.stringify(disabled)).not.toContain("server-secret");
  });
});
