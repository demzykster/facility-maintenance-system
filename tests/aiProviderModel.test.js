import { describe, expect, it } from "vitest";
import { AI_MODES, AI_PROVIDERS, aiModeFromEnv, aiServerConfigFromEnv, normalizeAiProvider, productionAiPolicy } from "../src/aiProviderModel.js";

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
    expect(normalizeAiProvider("codex")).toBe("");
    expect(aiServerConfigFromEnv({
      VITE_CMMS_APP_MODE: "production",
      CMMS_AI_MODE: "server",
      CMMS_AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test"
    })).toMatchObject({
      mode: AI_MODES.server,
      provider: AI_PROVIDERS.openai,
      model: "gpt-5.2",
      openaiApiKey: "sk-test"
    });
  });
});
