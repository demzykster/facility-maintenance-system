import { describe, expect, it, vi } from "vitest";
import { callAiProvider, __test } from "../server/ai/providerClient.js";

function sdkFactory(providerName) {
  return vi.fn((options) => (modelId) => ({
    modelId,
    providerName,
    options
  }));
}

describe("ai provider client", () => {
  it("uses the Vercel AI SDK seam for Anthropic without returning provider secrets", async () => {
    const createAnthropic = sdkFactory("anthropic");
    const generateTextImpl = vi.fn().mockResolvedValue({
      text: "טיוטה מוכנה",
      finishReason: "stop",
      usage: { inputTokens: 3, outputTokens: 2 }
    });

    const result = await callAiProvider({
      config: { provider: "anthropic", anthropicApiKey: "anthropic-secret", model: "claude-test" },
      system: "system",
      prompt: "prompt",
      generateTextImpl,
      sdk: { createAnthropic },
      maxTokens: 120
    });

    expect(result).toEqual({
      ok: true,
      provider: "anthropic",
      model: "claude-test",
      text: "טיוטה מוכנה",
      raw: {
        finishReason: "stop",
        usage: { inputTokens: 3, outputTokens: 2 }
      }
    });
    expect(createAnthropic).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "anthropic-secret" }));
    expect(generateTextImpl).toHaveBeenCalledWith({
      model: expect.objectContaining({ modelId: "claude-test", providerName: "anthropic" }),
      system: "system",
      prompt: "prompt",
      maxOutputTokens: 120
    });
    expect(JSON.stringify(result)).not.toContain("anthropic-secret");
  });

  it("uses OpenAI Responses-compatible SDK models for Codex/OpenAI provider mode", async () => {
    const createOpenAI = sdkFactory("openai");
    const generateTextImpl = vi.fn().mockResolvedValue({ text: "draft ready" });

    const result = await callAiProvider({
      config: { provider: "openai", openaiApiKey: "openai-secret", model: "gpt-5.2" },
      system: "system",
      prompt: "prompt",
      generateTextImpl,
      sdk: { createOpenAI },
      maxTokens: 200
    });

    expect(result).toMatchObject({ ok: true, provider: "openai", model: "gpt-5.2", text: "draft ready" });
    expect(createOpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "openai-secret" }));
    expect(generateTextImpl).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: "gpt-5.2", providerName: "openai" }),
      maxOutputTokens: 200
    }));
    expect(JSON.stringify(result)).not.toContain("openai-secret");
  });

  it("clamps tiny provider checks to the provider-safe output token floor", async () => {
    const createOpenAI = sdkFactory("openai");
    const generateTextImpl = vi.fn().mockResolvedValue({ text: "OK" });

    await callAiProvider({
      config: { provider: "openai", openaiApiKey: "openai-secret", model: "gpt-5.2" },
      system: "system",
      prompt: "prompt",
      generateTextImpl,
      sdk: { createOpenAI },
      maxTokens: 8
    });

    expect(generateTextImpl).toHaveBeenCalledWith(expect.objectContaining({
      maxOutputTokens: 16
    }));
    expect(__test.safeTokenLimit(8, 16)).toBe(16);
  });

  it("uses Google Gemini SDK models for Google provider mode", async () => {
    const createGoogleGenerativeAI = sdkFactory("google");
    const generateTextImpl = vi.fn().mockResolvedValue({ text: "gemini ready" });

    const result = await callAiProvider({
      config: { provider: "gemini", googleApiKey: "google-secret", model: "gemini-2.0-flash" },
      system: "system",
      prompt: "prompt",
      generateTextImpl,
      sdk: { createGoogleGenerativeAI },
      maxTokens: 120
    });

    expect(result).toMatchObject({ ok: true, provider: "google", model: "gemini-2.0-flash", text: "gemini ready" });
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "google-secret" }));
    expect(generateTextImpl).toHaveBeenCalledWith(expect.objectContaining({
      model: expect.objectContaining({ modelId: "gemini-2.0-flash", providerName: "google" }),
      maxOutputTokens: 120
    }));
    expect(JSON.stringify(result)).not.toContain("google-secret");
  });

  it("fails closed when required provider keys are missing", async () => {
    await expect(callAiProvider({ config: { provider: "anthropic" } })).resolves.toMatchObject({
      ok: false,
      error: "anthropic_api_key_required"
    });
    await expect(callAiProvider({ config: { provider: "openai" } })).resolves.toMatchObject({
      ok: false,
      error: "openai_api_key_required"
    });
    await expect(callAiProvider({ config: { provider: "gemini" } })).resolves.toMatchObject({
      ok: false,
      error: "google_api_key_required"
    });
  });

  it("normalizes provider SDK failures into stable non-secret results", async () => {
    const createGoogleGenerativeAI = sdkFactory("google");
    const generateTextImpl = vi.fn().mockRejectedValue(new Error("quota exceeded for this project"));

    const result = await callAiProvider({
      config: { provider: "google", googleApiKey: "google-secret", model: "gemini-2.0-flash" },
      generateTextImpl,
      sdk: { createGoogleGenerativeAI }
    });

    expect(result).toEqual({
      ok: false,
      provider: "google",
      model: "gemini-2.0-flash",
      error: "quota exceeded for this project"
    });
    expect(JSON.stringify(result)).not.toContain("google-secret");
  });
});
