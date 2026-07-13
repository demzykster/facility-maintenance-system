import { describe, expect, it } from "vitest";
import { AI_MODES, AI_PROVIDER_LABELS, AI_PROVIDER_MODEL_OPTIONS, AI_PROVIDER_OPTIONS, AI_PROVIDERS, aiModeFromEnv, aiServerConfigFromEnv, normalizeAiProvider, normalizeAiSettings, productionAiPolicy, publicAiServerStatusFromEnv } from "../src/aiProviderModel.js";

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
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "gemini" }
    })).toMatchObject({
      ok: false,
      provider: AI_PROVIDERS.google,
      errors: ["production_requires_google_api_key"]
    });
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "google", googleApiKey: "secret" }
    })).toMatchObject({
      ok: true,
      provider: AI_PROVIDERS.google,
      errors: []
    });
  });

  it("normalizes server provider configuration without exposing browser AI", () => {
    expect(normalizeAiProvider(" OPENAI ")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("codex")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("chatgpt")).toBe(AI_PROVIDERS.openai);
    expect(normalizeAiProvider("claude")).toBe(AI_PROVIDERS.anthropic);
    expect(normalizeAiProvider("gemini")).toBe(AI_PROVIDERS.google);
    expect(normalizeAiProvider("google")).toBe(AI_PROVIDERS.google);
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
      supportedModelOptions: AI_PROVIDER_MODEL_OPTIONS,
      errors: []
    });
    expect(AI_PROVIDER_LABELS[AI_PROVIDERS.openai]).toContain("Codex");
    expect(AI_PROVIDER_OPTIONS.find((option) => option.id === AI_PROVIDERS.google)?.models).toEqual([
      expect.objectContaining({ id: "gemini-2.5-flash", label: expect.stringContaining("Gemini") }),
      expect.objectContaining({ id: "gemini-2.0-flash", label: expect.stringContaining("Gemini") })
    ]);
    expect(AI_PROVIDER_MODEL_OPTIONS[AI_PROVIDERS.openai]).toEqual([
      expect.objectContaining({ id: "gpt-5.2", label: expect.stringContaining("GPT") })
    ]);
    expect(publicAiServerStatusFromEnv({
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "gemini",
      GOOGLE_GENERATIVE_AI_API_KEY: "google-secret"
    })).toMatchObject({
      mode: AI_MODES.server,
      provider: AI_PROVIDERS.google,
      model: "gemini-2.5-flash",
      providerKeyConfigured: true,
      serverReady: true,
      errors: []
    });
    const disabled = publicAiServerStatusFromEnv({
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "openai"
    });
    expect(disabled.serverReady).toBe(false);
    expect(disabled.errors).toContain("ai_provider_key_required");
    expect(JSON.stringify(disabled)).not.toContain("server-secret");
  });
});
