const MAX_MEMORY_FACTS = 8;
const MAX_TEXT = 280;

const cleanText = (value, limit = MAX_TEXT) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanId = (value) => cleanText(value, 120);

const MEMORY_QUESTION_RE = /(remember|memory|saved|what.*know|what.*did.*save|что.*(помнишь|запомнил|сохран|памят)|како[йе].*(факт|памят)|זוכר|זיכרון|זכרון|שמור|שמורה|מה.*שמר)/iu;

function isoDate(value) {
  const date = new Date(Number(value) || Date.parse(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function tokenSet(value = "") {
  return new Set(cleanText(value, 2_000)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3));
}

function relevanceScore(fact = {}, userRequest = "") {
  const requestTokens = tokenSet(userRequest);
  if (!requestTokens.size) return 0;
  const factTokens = tokenSet([
    fact.summary,
    fact.details,
    fact.factType,
    fact.scopeLabel,
    fact.sourceLabel
  ].join(" "));
  let score = 0;
  for (const token of factTokens) {
    if (requestTokens.has(token)) score += 1;
  }
  return score;
}

export function memoryQuestionAsked(userRequest = "") {
  return MEMORY_QUESTION_RE.test(cleanText(userRequest, 1_000));
}

export function retrievedMemoriesForProvider(facts = [], { userRequest = "", limit = MAX_MEMORY_FACTS } = {}) {
  const directMemoryQuestion = memoryQuestionAsked(userRequest);
  return (Array.isArray(facts) ? facts : [])
    .map((fact, index) => ({
      id: cleanId(fact.id),
      fact: cleanText(fact.summary),
      details: cleanText(fact.details, 500),
      scope: {
        type: cleanText(fact.scopeType, 40),
        id: cleanId(fact.scopeId),
        label: cleanText(fact.scopeLabel || fact.scopeType, 160)
      },
      source: {
        type: cleanText(fact.sourceType, 80),
        id: cleanId(fact.sourceId),
        label: cleanText(fact.sourceLabel || fact.sourceType || "CMMS memory", 160)
      },
      updatedAt: isoDate(fact.updatedAt),
      trust: "untrusted_business_context",
      _score: directMemoryQuestion ? 100 : relevanceScore(fact, userRequest),
      _index: index
    }))
    .filter((fact) => fact.id && fact.fact)
    .sort((a, b) => b._score - a._score || a._index - b._index)
    .slice(0, Math.min(Math.max(Number(limit) || MAX_MEMORY_FACTS, 1), 16))
    .map(({ _score, _index, ...fact }) => fact);
}

export function validateUsedMemoryIds(usedMemoryIds = [], retrievedMemories = []) {
  const allowed = new Set((Array.isArray(retrievedMemories) ? retrievedMemories : []).map((fact) => fact.id).filter(Boolean));
  const seen = new Set();
  const used = [];
  const rejected = [];
  for (const raw of Array.isArray(usedMemoryIds) ? usedMemoryIds : []) {
    const id = cleanId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (allowed.has(id)) used.push(id);
    else rejected.push(id);
  }
  return { usedMemoryIds: used, rejectedMemoryIds: rejected };
}

export function memoryCitationsForIds(retrievedMemories = [], usedMemoryIds = []) {
  const ids = new Set(usedMemoryIds);
  return (Array.isArray(retrievedMemories) ? retrievedMemories : [])
    .filter((fact) => ids.has(fact.id))
    .map((fact) => ({
      id: fact.id,
      summary: fact.fact,
      details: fact.details || "",
      scopeType: fact.scope?.type || "",
      scopeId: fact.scope?.id || "",
      scopeLabel: fact.scope?.label || "",
      sourceType: fact.source?.type || "",
      sourceId: fact.source?.id || "",
      sourceLabel: fact.source?.label || "",
      updatedAt: fact.updatedAt || ""
    }));
}

function memoryBlock(citations = []) {
  if (!citations.length) return "";
  const lines = citations.map((fact) => [
    `- ${fact.summary}`,
    `  Source: ${fact.sourceLabel || fact.sourceType || "CMMS memory"} · Scope: ${fact.scopeLabel || fact.scopeType || "memory"}${fact.updatedAt ? ` · Date: ${fact.updatedAt.slice(0, 10)}` : ""}`
  ].join("\n"));
  return ["Saved memory:", ...lines].join("\n");
}

export function groundedAssistantMemoryResponse({
  assistantText = "",
  retrievedMemories = [],
  providerUsedMemoryIds = [],
  userRequest = ""
} = {}) {
  const validated = validateUsedMemoryIds(providerUsedMemoryIds, retrievedMemories);
  let usedMemoryIds = validated.usedMemoryIds;
  let mode = usedMemoryIds.length ? "provider_reported" : "none";
  if (!usedMemoryIds.length && memoryQuestionAsked(userRequest) && retrievedMemories.length) {
    usedMemoryIds = retrievedMemories.map((fact) => fact.id);
    mode = "server_cited_memory_fallback";
  }
  const memoryCitations = memoryCitationsForIds(retrievedMemories, usedMemoryIds);
  const block = mode === "server_cited_memory_fallback" ? memoryBlock(memoryCitations) : "";
  const safeAssistantText = String(assistantText || "").trim().slice(0, 4_000);
  const text = block
    ? [safeAssistantText, block].filter(Boolean).join("\n\n")
    : safeAssistantText;
  return {
    text,
    memoryCitations,
    memoryGrounding: {
      mode,
      retrievedCount: retrievedMemories.length,
      usedMemoryIds,
      rejectedMemoryIds: validated.rejectedMemoryIds
    }
  };
}
