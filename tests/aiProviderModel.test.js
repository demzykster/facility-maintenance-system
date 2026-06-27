import { describe, expect, it } from "vitest";
import { AI_MODES, aiModeFromEnv, productionAiPolicy } from "../src/aiProviderModel.js";

describe("aiProviderModel", () => {
  it("defaults browser AI to demo only and disables it in production", () => {
    expect(aiModeFromEnv({}, "demo")).toBe(AI_MODES.client);
    expect(aiModeFromEnv({}, "production")).toBe(AI_MODES.disabled);
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
      errors: ["production_requires_ai_provider", "production_requires_anthropic_api_key"]
    });
    expect(productionAiPolicy({
      appMode: "production",
      ai: { mode: "server", provider: "anthropic", anthropicApiKey: "secret" }
    })).toMatchObject({
      ok: true,
      errors: []
    });
  });
});
