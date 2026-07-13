import { AI_PROVIDERS, DEFAULT_AI_MODELS, normalizeAiProvider } from "../../src/aiProviderModel.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_GENERATE_CONTENT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const readJsonOrText = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

const compactText = (value, limit = 6_000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const safeTokenLimit = (value, minimum) => Math.max(minimum, Number.isFinite(Number(value)) ? Number(value) : minimum);

function providerError(data, fallback) {
  return data?.error?.message || data?.message || data?.text || fallback;
}

function extractOpenAiText(data = {}) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractAnthropicText(data = {}) {
  return (data.content || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiText(data = {}) {
  return (data.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function geminiModelUrl(model = "") {
  return `${GEMINI_GENERATE_CONTENT_BASE_URL}/${encodeURIComponent(model)}:generateContent`;
}

export async function callAiProvider({ config = {}, system = "", prompt = "", fetchImpl = globalThis.fetch, maxTokens = 900 } = {}) {
  const provider = normalizeAiProvider(config.provider);
  if (!provider) return { ok: false, error: "ai_provider_required" };
  if (!fetchImpl) return { ok: false, error: "fetch_unavailable" };

  const model = String(config.model || DEFAULT_AI_MODELS[provider] || "").trim();
  const safeSystem = compactText(system);
  const safePrompt = compactText(prompt);

  if (provider === AI_PROVIDERS.anthropic) {
    if (!config.anthropicApiKey) return { ok: false, error: "anthropic_api_key_required" };
    const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": config.anthropicApiKey
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: safeSystem,
        messages: [{ role: "user", content: safePrompt }]
      })
    });
    const data = await readJsonOrText(response);
    if (!response.ok) return { ok: false, error: providerError(data, `anthropic_http_${response.status}`) };
    return { ok: true, provider, model, text: extractAnthropicText(data), raw: data };
  }

  if (provider === AI_PROVIDERS.google) {
    if (!config.googleApiKey) return { ok: false, error: "google_api_key_required" };
    const response = await fetchImpl(geminiModelUrl(model), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.googleApiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: safeSystem }] },
        contents: [{ role: "user", parts: [{ text: safePrompt }] }],
        generationConfig: {
          maxOutputTokens: safeTokenLimit(maxTokens, 16)
        }
      })
    });
    const data = await readJsonOrText(response);
    if (!response.ok) return { ok: false, error: providerError(data, `google_http_${response.status}`) };
    return { ok: true, provider, model, text: extractGeminiText(data), raw: data };
  }

  if (provider === AI_PROVIDERS.openai) {
    if (!config.openaiApiKey) return { ok: false, error: "openai_api_key_required" };
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        instructions: safeSystem,
        input: safePrompt,
        max_output_tokens: safeTokenLimit(maxTokens, 16)
      })
    });
    const data = await readJsonOrText(response);
    if (!response.ok) return { ok: false, error: providerError(data, `openai_http_${response.status}`) };
    return { ok: true, provider, model, text: extractOpenAiText(data), raw: data };
  }

  return { ok: false, error: "ai_provider_unsupported" };
}
