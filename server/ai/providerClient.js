import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_PROVIDERS, DEFAULT_AI_MODELS, normalizeAiProvider } from "../../src/aiProviderModel.js";

const compactText = (value, limit = 6_000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const safeTokenLimit = (value, minimum) => Math.max(minimum, Number.isFinite(Number(value)) ? Number(value) : minimum);

function providerError(data, fallback) {
  return data?.error?.message || data?.message || data?.cause?.message || data?.text || fallback;
}

function createSdkModel({ provider, model, config, fetchImpl, sdk = {} } = {}) {
  if (provider === AI_PROVIDERS.anthropic) {
    const factory = sdk.createAnthropic || createAnthropic;
    return factory({ apiKey: config.anthropicApiKey, fetch: fetchImpl })(model);
  }
  if (provider === AI_PROVIDERS.google) {
    const factory = sdk.createGoogleGenerativeAI || createGoogleGenerativeAI;
    return factory({ apiKey: config.googleApiKey, fetch: fetchImpl })(model);
  }
  if (provider === AI_PROVIDERS.openai) {
    const factory = sdk.createOpenAI || createOpenAI;
    return factory({ apiKey: config.openaiApiKey, fetch: fetchImpl })(model);
  }
  return null;
}

export async function callAiProvider({ config = {}, system = "", prompt = "", fetchImpl = globalThis.fetch, maxTokens = 900, generateTextImpl = generateText, sdk = {} } = {}) {
  const provider = normalizeAiProvider(config.provider);
  if (!provider) return { ok: false, error: "ai_provider_required" };

  const model = String(config.model || DEFAULT_AI_MODELS[provider] || "").trim();
  const safeSystem = compactText(system);
  const safePrompt = compactText(prompt);

  if (provider === AI_PROVIDERS.anthropic) {
    if (!config.anthropicApiKey) return { ok: false, error: "anthropic_api_key_required" };
  }
  if (provider === AI_PROVIDERS.google) {
    if (!config.googleApiKey) return { ok: false, error: "google_api_key_required" };
  }
  if (provider === AI_PROVIDERS.openai) {
    if (!config.openaiApiKey) return { ok: false, error: "openai_api_key_required" };
  }

  const sdkModel = createSdkModel({ provider, model, config, fetchImpl, sdk });
  if (!sdkModel) return { ok: false, error: "ai_provider_unsupported" };

  try {
    const result = await generateTextImpl({
      model: sdkModel,
      system: safeSystem,
      prompt: safePrompt,
      maxOutputTokens: safeTokenLimit(maxTokens, 16)
    });
    return {
      ok: true,
      provider,
      model,
      text: String(result?.text || "").trim(),
      raw: {
        finishReason: result?.finishReason || "",
        usage: result?.usage || null
      }
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      model,
      error: providerError(error, `${provider}_provider_failed`)
    };
  }
}

export const __test = {
  createSdkModel,
  safeTokenLimit
};
