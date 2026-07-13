import { describe, expect, it, vi } from "vitest";
import { callAiProvider } from "../server/ai/providerClient.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body))
  };
}

describe("ai provider client", () => {
  it("builds Anthropic server-side message requests without browser secrets", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      content: [{ type: "text", text: "טיוטה מוכנה" }]
    }));

    const result = await callAiProvider({
      config: { provider: "anthropic", anthropicApiKey: "anthropic-secret", model: "claude-test" },
      system: "system",
      prompt: "prompt",
      fetchImpl,
      maxTokens: 120
    });

    expect(result).toMatchObject({ ok: true, provider: "anthropic", model: "claude-test", text: "טיוטה מוכנה" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "x-api-key": "anthropic-secret",
        "anthropic-version": "2023-06-01"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      model: "claude-test",
      max_tokens: 120,
      system: "system",
      messages: [{ role: "user", content: "prompt" }]
    });
  });

  it("builds OpenAI Responses API requests for Codex/OpenAI provider mode", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      output_text: "draft ready"
    }));

    const result = await callAiProvider({
      config: { provider: "openai", openaiApiKey: "openai-secret", model: "gpt-5.2" },
      system: "system",
      prompt: "prompt",
      fetchImpl,
      maxTokens: 200
    });

    expect(result).toMatchObject({ ok: true, provider: "openai", model: "gpt-5.2", text: "draft ready" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer openai-secret"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      model: "gpt-5.2",
      instructions: "system",
      input: "prompt",
      max_output_tokens: 200
    });
  });

  it("clamps OpenAI Responses max output tokens to the provider minimum", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      output_text: "OK"
    }));

    await callAiProvider({
      config: { provider: "openai", openaiApiKey: "openai-secret", model: "gpt-5.2" },
      system: "system",
      prompt: "prompt",
      fetchImpl,
      maxTokens: 8
    });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      max_output_tokens: 16
    });
  });

  it("builds Gemini generateContent requests for Google provider mode", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      candidates: [{
        content: {
          parts: [{ text: "gemini ready" }]
        }
      }]
    }));

    const result = await callAiProvider({
      config: { provider: "gemini", googleApiKey: "google-secret", model: "gemini-2.0-flash" },
      system: "system",
      prompt: "prompt",
      fetchImpl,
      maxTokens: 120
    });

    expect(result).toMatchObject({ ok: true, provider: "google", model: "gemini-2.0-flash", text: "gemini ready" });
    expect(fetchImpl).toHaveBeenCalledWith("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "x-goog-api-key": "google-secret"
      })
    }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      systemInstruction: { parts: [{ text: "system" }] },
      contents: [{ role: "user", parts: [{ text: "prompt" }] }],
      generationConfig: { maxOutputTokens: 120 }
    });
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
});
