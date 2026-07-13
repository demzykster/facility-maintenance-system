import { generateObject, generateText, jsonSchema } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_PROVIDER_MODEL_OPTIONS, AI_PROVIDERS, DEFAULT_AI_MODELS, normalizeAiProvider } from "../../src/aiProviderModel.js";

const compactText = (value, limit = 6_000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const safeTokenLimit = (value, minimum) => Math.max(minimum, Number.isFinite(Number(value)) ? Number(value) : minimum);

function providerError(data, fallback) {
  return data?.error?.message || data?.message || data?.cause?.message || data?.text || fallback;
}

function transientProviderError(error = "") {
  return /high demand|try again later|temporar(?:y|ily)|overloaded|rate.?limit|429/i.test(String(error || ""));
}

function modelCandidates(provider, model) {
  const primary = String(model || DEFAULT_AI_MODELS[provider] || "").trim();
  const configured = primary ? [primary] : [];
  if (provider !== AI_PROVIDERS.google) return configured;
  const options = Array.isArray(AI_PROVIDER_MODEL_OPTIONS[provider])
    ? AI_PROVIDER_MODEL_OPTIONS[provider].map((option) => option.id).filter(Boolean)
    : [];
  return Array.from(new Set([...configured, ...options]));
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

  let lastError = "";
  for (const candidate of modelCandidates(provider, model)) {
    const sdkModel = createSdkModel({ provider, model: candidate, config, fetchImpl, sdk });
    if (!sdkModel) return { ok: false, error: "ai_provider_unsupported" };

    try {
      const result = await generateTextImpl({
        model: sdkModel,
        system: safeSystem,
        prompt: safePrompt,
        maxOutputTokens: safeTokenLimit(maxTokens, 16)
      });
      const raw = {
        finishReason: result?.finishReason || "",
        usage: result?.usage || null
      };
      if (candidate !== model) raw.fallbackFrom = model;
      return {
        ok: true,
        provider,
        model: candidate,
        text: String(result?.text || "").trim(),
        raw
      };
    } catch (error) {
      lastError = providerError(error, `${provider}_provider_failed`);
      if (!transientProviderError(lastError)) break;
    }
  }

  return {
    ok: false,
    provider,
    model,
    error: lastError || `${provider}_provider_failed`
  }
}

export async function callAiProviderObject({
  config = {},
  system = "",
  prompt = "",
  schema = {},
  schemaName = "cmms_ai_object",
  schemaDescription = "",
  fetchImpl = globalThis.fetch,
  maxTokens = 900,
  generateObjectImpl = generateObject,
  sdk = {}
} = {}) {
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

  let lastError = "";
  for (const candidate of modelCandidates(provider, model)) {
    const sdkModel = createSdkModel({ provider, model: candidate, config, fetchImpl, sdk });
    if (!sdkModel) return { ok: false, error: "ai_provider_unsupported" };

    try {
      const result = await generateObjectImpl({
        model: sdkModel,
        system: safeSystem,
        prompt: safePrompt,
        schema: jsonSchema(schema),
        schemaName: compactText(schemaName, 80) || "cmms_ai_object",
        schemaDescription: compactText(schemaDescription, 400),
        maxOutputTokens: safeTokenLimit(maxTokens, 64)
      });
      const raw = {
        finishReason: result?.finishReason || "",
        usage: result?.usage || null
      };
      if (candidate !== model) raw.fallbackFrom = model;
      return {
        ok: true,
        provider,
        model: candidate,
        object: result?.object || {},
        raw
      };
    } catch (error) {
      lastError = providerError(error, `${provider}_provider_failed`);
      if (!transientProviderError(lastError)) break;
    }
  }

  return {
    ok: false,
    provider,
    model,
    error: lastError || `${provider}_provider_failed`
  }
}

export const __test = {
  createSdkModel,
  modelCandidates,
  safeTokenLimit
};
