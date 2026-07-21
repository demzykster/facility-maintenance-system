import { SYSTEM_DOWNTIME_NEEDS_TRIAGE } from "./ticketCreateContract.js";

const HOUR = 3600000;
const MAX_SUBJECT_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 1200;

export const INLINE_TICKET_INTAKE_WORKFLOW = "ticket_intake";
export const INLINE_TICKET_INTAKE_STATUSES = Object.freeze({
  collecting: "collecting",
  ready: "ready",
  creating: "creating",
  created: "created",
  blocked: "blocked",
  failed: "failed"
});

const FACILITY_CATEGORY_ALIASES = Object.freeze({
  electric: ["חשמל", "תאורה", "שקע", "מפסק", "נורה", "electric", "light"],
  plumbing: ["מים", "נזילה", "ברז", "כיור", "ביוב", "סתימה", "plumbing", "leak", "water"],
  hvac: ["מזגן", "מיזוג", "קירור", "חימום", "אוורור", "טמפרטורה", "air condition", "a/c", "hvac"],
  mechanical: ["מנוע", "מכני", "משאבה", "רצועה", "מסוע"],
  safety: ["בטיחות", "כיבוי", "אש", "מטף", "גלאי", "חירום", "safety"],
  it: ["מחשב", "מדפסת", "רשת", "מסך", "שרת", "it", "network", "printer"],
  building: ["דלת", "שער", "קיר", "רצפה", "תקרה", "חלון", "מבנה", "building", "door", "gate", "wall", "floor"],
  cleaning: ["ניקיון", "נקיון", "לכלוך", "פסולת"],
  other: ["אחר", "כללי", "other"]
});

const TRANSPORT_ENTITY_WORDS = Object.freeze([
  "מלגזה",
  "מלגז",
  "מלקטת",
  "מעמיס",
  "רכב",
  "משאית",
  "כלי שינוע",
  "שינוע",
  "forklift",
  "truck",
  "vehicle",
  "машина",
  "машин",
  "машине",
  "машины",
  "погрузчик",
  "транспорт",
  "транспортн",
  "техника"
]);

const FACILITY_ENTITY_WORDS = Object.freeze([
  "בניין",
  "מבנה",
  "חדר",
  "משרד",
  "מחסן",
  "רציף",
  "אזור",
  "מחלקה",
  "תשתית",
  "building",
  "room",
  "office",
  "warehouse",
  "infrastructure"
]);

const EXPLICIT_HIGH_PRIORITY_RE = /(דחוף|מיידי|מסוכן|סכנה|חירום|שריפה|הצפה|עשן|ניצוץ|urgent|critical|danger|fire|flood|smoke)/iu;
const EXPLICIT_LOW_PRIORITY_RE = /(לא\s+דחוף|נמוך|נמוכה|low\s+priority|not\s+urgent)/iu;
const EXPLICIT_MEDIUM_PRIORITY_RE = /(בינוני|בינונית|רגיל|רגילה|medium(?:\s+priority)?|normal\s+priority|средн(?:ий|яя|ее)|обычн(?:ый|ая|ое))/iu;

const cleanText = (value, limit = 1000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanArray = (value) => Array.isArray(value) ? value : [];
const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function lookupText(value = "") {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/[״"׳']/gu, "")
    .replace(/[.,;:!?()[\]{}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupTokens(value = "") {
  return lookupText(value).split(" ").filter(Boolean);
}

function normalizeHebrewChoiceToken(value = "") {
  const raw = lookupText(value);
  if (!raw) return "";
  let token = raw;
  if (/^[הבכלוש][\u0590-\u05FF]{2,}$/u.test(token)) token = token.slice(1);
  if (token.endsWith("יים") && token.length > 4) token = token.slice(0, -3);
  else if (token.endsWith("ים") && token.length > 3) token = token.slice(0, -2);
  else if (token.endsWith("ות") && token.length > 3) token = token.slice(0, -2);
  if (token.endsWith("י") && token.length > 3) token = token.slice(0, -1);
  if ((token.endsWith("ה") || token.endsWith("ת")) && token.length > 3) token = token.slice(0, -1);
  return token;
}

function candidateLookupTokens(value = "") {
  return [...new Set(lookupTokens(value)
    .flatMap((token) => [token, normalizeHebrewChoiceToken(token)])
    .filter((token) => token && token.length >= 2))];
}

function includesTerm(text = "", term = "") {
  const clean = lookupText(text);
  const candidate = lookupText(term);
  if (!clean || !candidate) return false;
  if (candidate.length < 2) return false;
  if (/[\u0400-\u04FF]/u.test(candidate) && candidate.length >= 4) return clean.includes(candidate);
  if (/[\u0590-\u05FF]/u.test(candidate)) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}]|[בלמהוכש])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(clean);
  }
  if (/^[\p{L}\p{N}\s-]+$/u.test(candidate)) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(clean);
  }
  return clean.includes(candidate);
}

function compactSubject(text = "") {
  const raw = cleanText(text, MAX_DESCRIPTION_CHARS);
  if (!raw) return "";
  return raw.length > MAX_SUBJECT_CHARS ? `${raw.slice(0, MAX_SUBJECT_CHARS - 1).trim()}...` : raw;
}

function actorTicketPayload(actor = {}) {
  return {
    id: cleanText(actor.id || actor.authUserId || actor.workerNo, 160),
    name: cleanText(actor.name, 120),
    role: cleanText(actor.role, 40),
    dept: cleanText(actor.dept || actor.department, 120),
    phone: "",
    email: ""
  };
}

function actorDepartment(actor = {}) {
  return cleanText(
    actor.dept
      || actor.department
      || (Array.isArray(actor.depts) ? actor.depts[0] : "")
      || (Array.isArray(actor.departments) ? actor.departments[0] : ""),
    120
  );
}

function identifierCandidates(text = "") {
  const raw = cleanText(text, 1000);
  return [...raw.matchAll(/(?:^|[^\p{L}\p{N}])#?(\d{2,})(?=$|[^\p{L}\p{N}])/giu)]
    .map((match) => match[1])
    .filter(Boolean);
}

function normalizeIdentifier(value = "") {
  return cleanText(value, 160).toLowerCase();
}

function unitIdentifiers(unit = {}) {
  return [
    unit.id,
    unit.code,
    unit.num,
    unit.number,
    unit.asset,
    unit.unitCode,
    unit.workerNo,
    unit.workerNumber,
    unit.vehicleNo,
    unit.vehicleNumber,
    unit.registration,
    unit.registrationNumber,
    unit.licensePlate,
    unit.displayNumber,
    unit.displayNo,
    ...(Array.isArray(unit.aliases) ? unit.aliases : [])
  ].map((value) => cleanText(value, 160)).filter(Boolean);
}

function unitMatchesIdentifier(unit = {}, identifier = "") {
  const cleanIdentifier = normalizeIdentifier(identifier);
  return unitIdentifiers(unit).some((value) => normalizeIdentifier(value) === cleanIdentifier);
}

function unitAvailableForTicketCreate(unit = {}) {
  const status = normalizeIdentifier(unit.status || unit.state);
  return !["archived", "inactive", "disabled", "deleted", "decommissioned"].includes(status);
}

function visibleFleet(context = {}, fullVisibleFleet = null) {
  const source = Array.isArray(fullVisibleFleet) && fullVisibleFleet.length ? fullVisibleFleet : context.fleet;
  return cleanArray(source)
    .filter((unit) => unit && unit.id)
    .filter(unitAvailableForTicketCreate);
}

function currentEntityLooksLikeAsset(current = {}) {
  if (!current || typeof current !== "object") return false;
  return current.type === "fleet"
    || current.type === "asset"
    || current.kind === "fleet"
    || current.id
    || current.code
    || current.num
    || current.number
    || current.asset
    || current.unitCode
    || current.workerNo
    || current.vehicleNumber
    || current.licensePlate
    || current.displayNumber;
}

function findVisibleCurrentAsset({ fleet = [], currentEntity = {} } = {}) {
  const current = cleanObject(currentEntity);
  if (!currentEntityLooksLikeAsset(current)) return null;
  const id = cleanText(current.id, 160);
  const code = cleanText(current.code || current.num || current.number || current.asset || current.unitCode || current.workerNo || current.vehicleNumber || current.licensePlate || current.displayNumber, 160);
  if (!id && !code) return null;
  if (id) {
    const match = fleet.find((unit) => cleanText(unit.id, 160).toLowerCase() === id.toLowerCase());
    if (match) return { status: "matched", asset: match, identifiers: [id, code].filter(Boolean), source: "current_entity" };
    return { status: "not_found", identifiers: [id, code].filter(Boolean), source: "current_entity" };
  }
  const matches = fleet.filter((unit) => unitMatchesIdentifier(unit, code));
  const unique = [...new Map(matches.map((unit) => [unit.id, unit])).values()];
  if (unique.length === 1) return { status: "matched", asset: unique[0], identifiers: [code], source: "current_entity" };
  if (unique.length > 1) return { status: "ambiguous", matches: unique, identifiers: [code], source: "current_entity" };
  return { status: "not_found", identifiers: [code], source: "current_entity" };
}

export function findVisibleTicketIntakeAsset({ text = "", context = {}, currentEntity = null, fullVisibleFleet = null } = {}) {
  const fleet = visibleFleet(context, fullVisibleFleet);
  const currentMatch = findVisibleCurrentAsset({ fleet, currentEntity });
  if (currentMatch) return currentMatch;
  const identifiers = identifierCandidates(text);
  if (!identifiers.length) return { status: "missing_identifier", identifiers: [] };
  const matches = [];
  for (const identifier of identifiers) {
    fleet.filter((unit) => unitMatchesIdentifier(unit, identifier)).forEach((unit) => matches.push(unit));
  }
  const unique = [...new Map(matches.map((unit) => [unit.id, unit])).values()];
  if (unique.length === 1) return { status: "matched", asset: unique[0], identifiers };
  if (unique.length > 1) return { status: "ambiguous", matches: unique, identifiers };
  return { status: "not_found", identifiers };
}

function transportTermsFromFleet(fleet = []) {
  return cleanArray(fleet)
    .flatMap((unit) => [unit.type, unit.model, unit.title])
    .map((value) => cleanText(value, 80))
    .filter((value) => lookupTokens(value).length <= 4 && value.length >= 2);
}

function hasTransportEntity(text = "", fleet = []) {
  const terms = [...TRANSPORT_ENTITY_WORDS, ...transportTermsFromFleet(fleet)];
  return terms.some((word) => includesTerm(text, word));
}

function facilityCategories(config = {}) {
  const configured = cleanArray(config.categories)
    .map((category) => ({
      id: cleanText(category?.id || category, 80),
      label: cleanText(category?.label || category?.name || category?.id || category, 120),
      aliases: [
        ...(Array.isArray(category?.aliases) ? category.aliases : []),
        ...(FACILITY_CATEGORY_ALIASES[cleanText(category?.id || category, 80)] || [])
      ].map((alias) => cleanText(alias, 120)).filter(Boolean)
    }))
    .filter((category) => category.id);
  return configured;
}

function maintenanceZones(config = {}) {
  return cleanArray(config.zones)
    .map((zone) => cleanText(zone?.name || zone?.label || zone, 160))
    .filter(Boolean);
}

function locationCandidateToken(index = 0) {
  return `location-choice-${Number(index) + 1}`;
}

function normalizeLocationClarificationCandidate(candidate = {}, index = 0) {
  const label = cleanText(candidate.label || candidate.location || candidate.name || candidate, 160);
  if (!label) return null;
  return {
    token: cleanText(candidate.token, 80) || locationCandidateToken(index),
    label,
    location: cleanText(candidate.location || label, 160) || label,
    order: Number.isFinite(Number(candidate.order)) ? Number(candidate.order) : index + 1
  };
}

function normalizeLocationClarification(value = null) {
  const source = cleanObject(value);
  const questionType = cleanText(source.questionType, 40);
  const candidates = cleanArray(source.candidates)
    .map(normalizeLocationClarificationCandidate)
    .filter(Boolean)
    .slice(0, 8)
    .map((candidate, index) => ({ ...candidate, token: candidate.token || locationCandidateToken(index), order: index + 1 }));
  if (questionType !== "choose_one" || candidates.length < 2) return null;
  return {
    questionType: "choose_one",
    field: "location",
    originalFragment: cleanText(source.originalFragment, 160),
    attemptCount: Math.max(0, Math.min(Number(source.attemptCount || 0) || 0, 10)),
    candidates
  };
}

function locationClarificationForMatches(matches = [], originalFragment = "", attemptCount = 0) {
  const candidates = cleanArray(matches)
    .map((location, index) => normalizeLocationClarificationCandidate({ location, label: location, token: locationCandidateToken(index), order: index + 1 }, index))
    .filter(Boolean);
  if (candidates.length < 2) return null;
  return {
    questionType: "choose_one",
    field: "location",
    originalFragment: cleanText(originalFragment, 160),
    attemptCount: Math.max(0, Math.min(Number(attemptCount) || 0, 10)),
    candidates
  };
}

function locationChoiceQuestion(clarification = null, prefix = "") {
  const state = normalizeLocationClarification(clarification);
  const candidates = state?.candidates || [];
  const list = candidates.map((candidate) => `• ${candidate.label}`).join("\n");
  const lead = cleanText(prefix, 200) || (candidates.length === 2 ? "מצאתי שני אזורים. למה התכוונת?" : "מצאתי כמה אזורים. למה התכוונת?");
  return [lead, list].filter(Boolean).join("\n");
}

function facilityCategoryFromText(text = "", config = {}) {
  const categories = facilityCategories(config);
  const matches = categories.filter((category) => [
    category.id,
    category.label,
    ...(Array.isArray(category.aliases) ? category.aliases : [])
  ].some((term) => includesTerm(text, term)));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const nonOther = matches.filter((category) => category.id !== "other");
    if (nonOther.length === 1) return nonOther[0];
  }
  return null;
}

function hasFacilitySignal(text = "", config = {}) {
  if (facilityCategoryFromText(text, config)) return true;
  if (Object.values(FACILITY_CATEGORY_ALIASES).flat().some((word) => includesTerm(text, word))) return true;
  return FACILITY_ENTITY_WORDS.some((word) => includesTerm(text, word));
}

function facilityConfigReady(config = {}) {
  return {
    categoriesReady: facilityCategories(config).length > 0,
    zonesReady: maintenanceZones(config).length > 0
  };
}

function normalizeZoneCandidate(value = "") {
  return cleanText(value, 160)
    .replace(/^(?:באזור|באיזור|באיזור|במחלקת|במחלקה|במשרדי|במשרד|במחסן|במבנה|בקו|אזור|איזור|מחלקת|מחלקה|משרדי|משרד|מחסן|מבנה|קו)\s+/iu, "")
    .replace(/^(?:ב|ל|אל)\s*/u, "")
    .replace(/\s+(?:בבקשה|please)$/iu, "")
    .trim();
}

function zoneMatchesText(zone = "", raw = "") {
  const zoneLookup = lookupText(zone);
  const textLookup = lookupText(raw);
  if (!zoneLookup || !textLookup) return false;
  if (zoneLookup === textLookup) return true;
  if (includesTerm(raw, zone)) return true;
  if (textLookup.length >= 3 && zoneLookup.includes(textLookup)) return true;
  return false;
}

function locationCandidates(text = "", pendingLocation = false) {
  const raw = cleanText(text, 500);
  if (!raw) return [];
  if (pendingLocation) return [normalizeZoneCandidate(raw)].filter(Boolean);
  const patterns = [
    /(?:באזור|באיזור|במחלקת|במחלקה|במשרדי|במשרד|במחסן|במבנה|בקו)\s+([^\n,.]+)/iu,
    /(?:zone|area|department|warehouse|building)\s+([^\n,.]+)/iu,
    /(?:^|\s)(ב?משרדי|ב?משרד|ב?מחסן|ב?קבלה)(?=$|[\s,.])/iu
  ];
  return patterns
    .map((pattern) => raw.match(pattern)?.[1])
    .map(normalizeZoneCandidate)
    .filter(Boolean);
}

function resolveFacilityLocation({ text = "", latestText = "", config = {}, pendingLocation = false } = {}) {
  const zones = maintenanceZones(config);
  const raw = cleanText(pendingLocation ? latestText || text : text, 500);
  const directMatches = zones.filter((zone) => includesTerm(raw, zone));
  const candidates = locationCandidates(raw, pendingLocation);
  const matchedByCandidate = candidates.flatMap((candidate) => zones.filter((zone) => zoneMatchesText(zone, candidate)));
  const unique = [...new Set([...directMatches, ...matchedByCandidate])];
  if (unique.length === 1) return { status: "matched", location: unique[0], candidates, zones };
  if (unique.length > 1) return { status: "ambiguous", matches: unique, candidates, zones };
  if (candidates.length) return { status: "not_found", candidates, zones };
  return { status: "missing", candidates: [], zones };
}

const ORDINAL_CHOICES = Object.freeze({
  "1": 1,
  "אחד": 1,
  "ראשון": 1,
  "הראשון": 1,
  "2": 2,
  "שתיים": 2,
  "שניים": 2,
  "שני": 2,
  "השני": 2,
  "3": 3,
  "שלוש": 3,
  "שלישי": 3,
  "השלישי": 3
});

function matchingCandidateScores(reply = "", candidates = [], choiceToken = "") {
  const cleanReply = lookupText(reply);
  const replyTokens = candidateLookupTokens(reply);
  const scores = [];
  const tokenChoice = cleanText(choiceToken, 80) || (/^location-choice-\d+$/u.test(cleanReply) ? cleanReply : "");
  for (const candidate of candidates) {
    const labelLookup = lookupText(candidate.label);
    const locationLookup = lookupText(candidate.location);
    const candidateTokens = candidateLookupTokens(`${candidate.label} ${candidate.location}`);
    let score = 0;
    if (tokenChoice && candidate.token === tokenChoice) score = Math.max(score, 100);
    if (cleanReply && (cleanReply === labelLookup || cleanReply === locationLookup)) score = Math.max(score, 90);
    if (cleanReply && (labelLookup.includes(cleanReply) || locationLookup.includes(cleanReply)) && cleanReply.length >= 3) score = Math.max(score, 55);
    const tokenHits = replyTokens.filter((token) => candidateTokens.includes(token));
    if (tokenHits.length) score = Math.max(score, 70 + tokenHits.length);
    if (score > 0) scores.push({ candidate, score });
  }
  return scores;
}

function resolvePendingLocationChoice({ reply = "", clarification = null, config = {}, choiceToken = "" } = {}) {
  const state = normalizeLocationClarification(clarification);
  if (!state) return null;
  const candidates = state.candidates;
  const cleanReply = lookupText(reply);
  const ordinal = ORDINAL_CHOICES[cleanReply] || ORDINAL_CHOICES[normalizeHebrewChoiceToken(cleanReply)];
  let matches = [];
  if (ordinal && candidates[ordinal - 1]) {
    matches = [{ candidate: candidates[ordinal - 1], score: 100 }];
  } else {
    matches = matchingCandidateScores(reply, candidates, choiceToken);
  }
  const bestScore = Math.max(0, ...matches.map((item) => item.score));
  const best = matches.filter((item) => item.score === bestScore);
  if (best.length === 1) {
    const location = best[0].candidate.location;
    const authoritative = maintenanceZones(config).some((zone) => lookupText(zone) === lookupText(location));
    if (!authoritative) return { status: "stale", location, clarification: state };
    return { status: "matched", location, clarification: state, candidate: best[0].candidate };
  }
  if (best.length > 1) return { status: "ambiguous", matches: best.map((item) => item.candidate.location), clarification: state };
  return { status: "unknown", clarification: state };
}

function roomHintFromText(text = "") {
  const raw = cleanText(text, 400);
  const match = raw.match(/(?:בחדר|חדר)\s+([^\n,.]+)/iu);
  if (!match) return "";
  const room = cleanText(`חדר ${match[1]}`, 120);
  if (/חדר\s+מפעיל\s+מערכת/u.test(room)) return "חדר מפעיל המערכת";
  return room;
}

function facilityLocationQuestion(text = "") {
  const room = roomHintFromText(text);
  if (room) return `באיזה אזור או מחלקה נמצא ${room}?`;
  return "באיזה אזור או מחלקה נמצאת התקלה?";
}

function priorityFromText(text = "") {
  const raw = cleanText(text, 500);
  if (EXPLICIT_LOW_PRIORITY_RE.test(raw)) return "low";
  if (EXPLICIT_HIGH_PRIORITY_RE.test(raw)) return "high";
  if (EXPLICIT_MEDIUM_PRIORITY_RE.test(raw)) return "medium";
  return "";
}

const priorityQuestion = () => "מה העדיפות: גבוהה, בינונית או נמוכה?";

function stripTrailingLocation(subject = "", location = "") {
  const raw = cleanText(subject, MAX_DESCRIPTION_CHARS);
  const zone = cleanText(location, 160);
  if (!raw || !zone) return raw;
  const escaped = zone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = raw
    .replace(new RegExp(`[.\\s]+(?:באזור|באיזור|במחלקת|במחלקה|במשרדי|במשרד|במחסן|במבנה|בקו)\\s+${escaped}\\s*$`, "iu"), "")
    .replace(new RegExp(`[.\\s]+${escaped}\\s*$`, "iu"), "")
    .trim();
  return stripped || raw;
}

function facilityDescriptionFromText(text = "", category = "", location = "") {
  const raw = stripTrailingLocation(cleanText(text, MAX_DESCRIPTION_CHARS), location);
  if (!raw) return "";
  if (!/[\u0590-\u05FF]/u.test(raw)) return raw;
  if (category === "hvac" && /מזגן|מיזוג|קירור|חימום|אוורור/u.test(raw)) {
    const normalized = raw
      .replace(/^ה?מזגן/u, "המזגן")
      .replace(/\s+לא\s+עובד/u, " אינו עובד");
    return cleanText(`דווח כי ${normalized}. יש לבדוק את התקלה.`, MAX_DESCRIPTION_CHARS);
  }
  return cleanText(`דווח על תקלה: ${raw}. יש לבדוק את הפרטים בשטח.`, MAX_DESCRIPTION_CHARS);
}

function assetDisplay(asset = {}) {
  return cleanText(asset.code || asset.num || asset.number || asset.asset || asset.unitCode || asset.workerNo || asset.vehicleNumber || asset.licensePlate || asset.displayNumber || asset.id, 160);
}

function buildTransportTicket({ text = "", asset = {}, priority = "", user = {}, now = Date.now(), ticketId = "" } = {}) {
  const actor = actorTicketPayload(user);
  const subject = compactSubject(text) || "תקלה בכלי שינוע";
  const department = cleanText(asset.department || asset.dept || actorDepartment(user), 120);
  return {
    id: cleanText(ticketId, 160),
    track: "transport",
    subject,
    category: "transport",
    categoryLabel: "",
    priority: cleanText(priority, 40),
    zone: "",
    asset: assetDisplay(asset),
    forkliftId: cleanText(asset.id, 160),
    downtimeType: SYSTEM_DOWNTIME_NEEDS_TRIAGE.id,
    description: cleanText(text, MAX_DESCRIPTION_CHARS),
    status: "new",
    assignee: "",
    routedTech: true,
    supplier: cleanText(asset.supplier, 160),
    department,
    downtimeStart: now,
    downtimeEnd: null,
    hasPhoto: false,
    closure: null,
    reportedBy: actor,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    dueAt: now + 24 * HOUR,
    ai: {
      source: "inline_ai_ticket_intake",
      autonomous: true,
      capability: "create_ticket",
      workflow: INLINE_TICKET_INTAKE_WORKFLOW,
      domain: "transport"
    },
    log: [{
      at: now,
      by: actor.name || "AI",
      byRole: actor.role,
      text: "נפתחה דרך inline AI ticket intake לפי דיווח משתמש",
      kind: "inline_ai_ticket_intake_create"
    }]
  };
}

function buildFacilityTicket({ text = "", baseText = "", category = {}, location = "", priority = "", user = {}, now = Date.now(), ticketId = "" } = {}) {
  const actor = actorTicketPayload(user);
  const sourceText = cleanText(baseText || text, MAX_DESCRIPTION_CHARS);
  const subject = compactSubject(stripTrailingLocation(sourceText, location)) || "תקלה באחזקת מבנה ומתקנים";
  const selectedPriority = cleanText(priority, 40);
  return {
    id: cleanText(ticketId, 160),
    track: "facility",
    subject,
    category: cleanText(category.id, 80),
    categoryLabel: cleanText(category.label, 120),
    priority: selectedPriority,
    zone: cleanText(location, 160),
    asset: "",
    forkliftId: null,
    downtimeType: null,
    description: facilityDescriptionFromText(sourceText, category.id, location),
    status: "new",
    assignee: "",
    routedTech: undefined,
    supplier: "",
    department: actorDepartment(user),
    hasPhoto: false,
    closure: null,
    reportedBy: actor,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    dueAt: now + (selectedPriority === "high" ? 4 : selectedPriority === "low" ? 72 : 24) * HOUR,
    ai: {
      source: "inline_ai_ticket_intake",
      autonomous: true,
      capability: "create_ticket",
      workflow: INLINE_TICKET_INTAKE_WORKFLOW,
      domain: "facility"
    },
    log: [{
      at: now,
      by: actor.name || "AI",
      byRole: actor.role,
      text: "נפתחה דרך inline AI ticket intake לפי דיווח משתמש",
      kind: "inline_ai_ticket_intake_create"
    }]
  };
}

function draftFromTicket(ticket = {}) {
  return {
    track: cleanText(ticket.track, 40),
    subject: cleanText(ticket.subject, 240),
    description: cleanText(ticket.description, MAX_DESCRIPTION_CHARS),
    category: cleanText(ticket.category, 80),
    categoryLabel: cleanText(ticket.categoryLabel, 120),
    priority: cleanText(ticket.priority, 40),
    zone: cleanText(ticket.zone, 160),
    asset: cleanText(ticket.asset, 160),
    forkliftId: cleanText(ticket.forkliftId, 160),
    downtimeType: cleanText(ticket.downtimeType, 80)
  };
}

export function normalizeInlineTicketIntakeSession(value = null) {
  const source = cleanObject(value);
  const domain = cleanText(source.domain, 40);
  if (!["facility", "transport", "unresolved"].includes(domain)) return null;
  const pendingField = cleanText(source.pendingField, 80);
  return {
    intakeId: cleanText(source.intakeId, 120) || "create_ticket",
    workflow: INLINE_TICKET_INTAKE_WORKFLOW,
    domain,
    status: cleanText(source.status, 40) || INLINE_TICKET_INTAKE_STATUSES.collecting,
    pendingField,
    choiceToken: cleanText(source.choiceToken, 80),
    clarification: normalizeLocationClarification(source.clarification),
    originalMessage: cleanText(source.originalMessage, MAX_DESCRIPTION_CHARS),
    draft: draftFromTicket(source.draft || source.payload || {})
  };
}

function collectingPlan({ domain, pendingField, question, unknowns = [], facts = [], draft = {}, originalMessage = "", clarification = null } = {}) {
  return {
    workflow: INLINE_TICKET_INTAKE_WORKFLOW,
    domain,
    status: INLINE_TICKET_INTAKE_STATUSES.collecting,
    pendingField,
    originalMessage: cleanText(originalMessage || draft.description || draft.subject, MAX_DESCRIPTION_CHARS),
    missingFields: pendingField ? [pendingField] : [],
    question,
    unknowns,
    facts,
    clarification: normalizeLocationClarification(clarification),
    draft: draftFromTicket(draft)
  };
}

function readyPlan({ domain, ticket, facts = [] } = {}) {
  return {
    workflow: INLINE_TICKET_INTAKE_WORKFLOW,
    domain,
    status: INLINE_TICKET_INTAKE_STATUSES.ready,
    pendingField: "",
    originalMessage: cleanText(ticket.description || ticket.subject, MAX_DESCRIPTION_CHARS),
    missingFields: [],
    question: "",
    unknowns: [],
    facts,
    draft: draftFromTicket(ticket),
    ticket
  };
}

export function buildInlineTicketIntakePlan({
  text = "",
  latestText = "",
  previousIntake = null,
  context = {},
  fullVisibleFleet = null,
  currentEntity = null,
  config = {},
  user = {},
  now = Date.now(),
  ticketId = ""
} = {}) {
  const rawText = cleanText(text, MAX_DESCRIPTION_CHARS);
  const latest = cleanText(latestText || text, MAX_DESCRIPTION_CHARS);
  const previous = normalizeInlineTicketIntakeSession(previousIntake);
  const baseText = cleanText(previous?.draft?.subject || previous?.originalMessage || rawText, MAX_DESCRIPTION_CHARS);
  const fleet = visibleFleet(context, fullVisibleFleet);
  const pendingPriority = previous?.pendingField === "priority";
  if (pendingPriority) {
    const priority = priorityFromText(latest);
    if (!priority) {
      return collectingPlan({
        domain: previous.domain,
        pendingField: "priority",
        question: priorityQuestion(),
        unknowns: ["priority"],
        draft: previous.draft,
        originalMessage: previous.originalMessage
      });
    }
    if (previous.domain === "transport") {
      const asset = fleet.find((item) => cleanText(item.id, 160) === previous.draft.forkliftId) || {
        id: previous.draft.forkliftId,
        code: previous.draft.asset
      };
      const ticket = buildTransportTicket({
        text: previous.originalMessage || previous.draft.description,
        asset,
        priority,
        user,
        now,
        ticketId
      });
      return readyPlan({
        domain: "transport",
        ticket,
        facts: [{ domain: "transport", assetId: ticket.forkliftId, assetCode: ticket.asset }]
      });
    }
    if (previous.domain === "facility") {
      const category = facilityCategories(config).find((item) => item.id === previous.draft.category);
      if (category && previous.draft.zone) {
        const ticket = buildFacilityTicket({
          text: previous.originalMessage || previous.draft.description,
          baseText: previous.originalMessage || previous.draft.description,
          category,
          location: previous.draft.zone,
          priority,
          user,
          now,
          ticketId
        });
        return readyPlan({
          domain: "facility",
          ticket,
          facts: [{ domain: "facility", location: ticket.zone, category: ticket.category, categoryLabel: ticket.categoryLabel }]
        });
      }
    }
  }
  const carriedPriority = ["high", "medium", "low"].includes(previous?.draft?.priority) ? previous.draft.priority : "";
  const selectedPriority = priorityFromText(previous?.originalMessage || rawText) || priorityFromText(latest) || carriedPriority;
  const pendingTransport = previous?.domain === "transport" && previous.pendingField === "asset";
  const pendingFacilityLocation = previous?.domain === "facility" && previous.pendingField === "location";
  const assetSearchText = pendingTransport ? latest : rawText;
  const assetResult = findVisibleTicketIntakeAsset({ text: assetSearchText, context: { ...context, fleet }, fullVisibleFleet: fleet, currentEntity });
  const facilitySignal = previous?.domain === "facility" || hasFacilitySignal(rawText, config);
  const facilityAuthority = facilityConfigReady(config);
  const transportEntity = previous?.domain === "transport"
    || hasTransportEntity(rawText, fleet)
    || (pendingTransport && latest)
    || (assetResult.status === "matched" && !facilitySignal)
    || (currentEntityLooksLikeAsset(currentEntity) && !facilitySignal)
    || (assetResult.status === "matched" && assetResult.source === "current_entity");

  if (transportEntity) {
    if (assetResult.status === "matched") {
      const priority = selectedPriority;
      const ticket = buildTransportTicket({
        text: baseText || rawText,
        asset: assetResult.asset,
        priority,
        user,
        now,
        ticketId
      });
      if (!priority) {
        return collectingPlan({
          domain: "transport",
          pendingField: "priority",
          question: priorityQuestion(),
          unknowns: ["priority"],
          facts: [{ domain: "transport", assetId: ticket.forkliftId, assetCode: ticket.asset }],
          draft: ticket,
          originalMessage: previous?.originalMessage || rawText
        });
      }
      return readyPlan({
        domain: "transport",
        ticket,
        facts: [{
          domain: "transport",
          assetId: ticket.forkliftId,
          assetCode: ticket.asset
        }]
      });
    }
    const draft = {
      track: "transport",
      subject: compactSubject(baseText || rawText) || "תקלה בכלי שינוע",
      description: cleanText(baseText || rawText, MAX_DESCRIPTION_CHARS),
      category: "transport",
      priority: selectedPriority,
      downtimeType: SYSTEM_DOWNTIME_NEEDS_TRIAGE.id
    };
    if (assetResult.status === "ambiguous") {
      return collectingPlan({
        domain: "transport",
        pendingField: "asset",
        question: "מצאתי כמה כלים מתאימים. מה מספר הכלי המדויק?",
        unknowns: ["asset"],
        facts: cleanArray(assetResult.matches).map((asset) => ({ assetId: cleanText(asset.id, 160), assetCode: assetDisplay(asset) })),
        draft,
        originalMessage: baseText || rawText
      });
    }
    if (assetResult.status === "not_found") {
      const identifier = cleanText(assetResult.identifiers?.[0], 80);
      return collectingPlan({
        domain: "transport",
        pendingField: "asset",
        question: identifier ? `לא מצאתי כלי גלוי במספר ${identifier}. מה המספר הנכון?` : "מה מספר הכלי?",
        unknowns: ["asset"],
        draft,
        originalMessage: baseText || rawText
      });
    }
    return collectingPlan({
      domain: "transport",
      pendingField: "asset",
      question: "מה מספר המלגזה?",
      unknowns: ["asset"],
      draft,
      originalMessage: baseText || rawText
    });
  }

  const category = facilityCategoryFromText(rawText, config);
  if (facilitySignal) {
    if (!facilityAuthority.categoriesReady) {
      return collectingPlan({
        domain: "facility",
        pendingField: "category",
        question: "לא ניתן כרגע לאמת את קטגוריית הקריאה. נסו שוב בעוד זמן קצר.",
        unknowns: ["category_config_unavailable"],
        draft: {
          track: "facility",
          subject: compactSubject(baseText || rawText),
          description: cleanText(baseText || rawText, MAX_DESCRIPTION_CHARS),
          priority: selectedPriority
        },
        originalMessage: baseText || rawText
      });
    }
    if (!category && !previous?.draft?.category) {
      return collectingPlan({
        domain: "facility",
        pendingField: "category",
        question: "לאיזו קטגוריית אחזקה זה שייך?",
        unknowns: ["category"],
        draft: {
          track: "facility",
          subject: compactSubject(baseText || rawText),
          description: cleanText(baseText || rawText, MAX_DESCRIPTION_CHARS),
          priority: selectedPriority
        },
        originalMessage: baseText || rawText
      });
    }
    const resolvedCategory = category || facilityCategories(config).find((item) => item.id === previous?.draft?.category);
    if (!resolvedCategory) {
      return collectingPlan({
        domain: "facility",
        pendingField: "category",
        question: "לא ניתן כרגע לאמת את קטגוריית הקריאה. נסו שוב בעוד זמן קצר.",
        unknowns: ["category_config_unavailable"],
        draft: {
          track: "facility",
          subject: compactSubject(baseText || rawText),
          description: cleanText(baseText || rawText, MAX_DESCRIPTION_CHARS),
          priority: selectedPriority
        },
        originalMessage: baseText || rawText
      });
    }
    if (!facilityAuthority.zonesReady) {
      return collectingPlan({
        domain: "facility",
        pendingField: "location",
        question: "לא ניתן כרגע לאמת את האזור. נסו שוב בעוד זמן קצר.",
        unknowns: ["location_config_unavailable"],
        draft: {
          track: "facility",
          subject: compactSubject(baseText || rawText),
          description: facilityDescriptionFromText(baseText || rawText, resolvedCategory.id, ""),
          category: resolvedCategory.id,
          categoryLabel: resolvedCategory.label,
          priority: selectedPriority
        },
        originalMessage: baseText || rawText
      });
    }
    const location = resolveFacilityLocation({
      text: rawText,
      latestText: latest,
      config,
      pendingLocation: pendingFacilityLocation
    });
    const pendingChoice = pendingFacilityLocation
      ? resolvePendingLocationChoice({
        reply: latest,
        clarification: previous?.clarification,
        config,
        choiceToken: previous?.choiceToken
      })
      : null;
    const locationResult = pendingChoice || location;
    const draftBase = {
      track: "facility",
      subject: compactSubject(stripTrailingLocation(baseText || rawText, locationResult.location || "")),
      description: facilityDescriptionFromText(baseText || rawText, resolvedCategory.id, locationResult.location || ""),
      category: resolvedCategory.id,
      categoryLabel: resolvedCategory.label,
      priority: selectedPriority,
      zone: locationResult.location || ""
    };
    if (locationResult.status === "matched") {
      const priority = selectedPriority;
      if (!priority) {
        return collectingPlan({
          domain: "facility",
          pendingField: "priority",
          question: priorityQuestion(),
          unknowns: ["priority"],
          facts: [{ domain: "facility", location: locationResult.location, category: resolvedCategory.id, categoryLabel: resolvedCategory.label }],
          draft: draftBase,
          originalMessage: previous?.originalMessage || rawText
        });
      }
      const ticket = buildFacilityTicket({
        text: rawText,
        baseText: baseText || rawText,
        category: resolvedCategory,
        location: locationResult.location,
        priority,
        user,
        now,
        ticketId
      });
      return readyPlan({
        domain: "facility",
        ticket,
        facts: [{
          domain: "facility",
          location: ticket.zone,
          category: ticket.category,
          categoryLabel: ticket.categoryLabel
        }]
      });
    }
    if (locationResult.status === "ambiguous") {
      const clarification = pendingChoice?.clarification
        || locationClarificationForMatches(locationResult.matches, location.candidates?.[0] || latest || rawText);
      return collectingPlan({
        domain: "facility",
        pendingField: "location",
        question: locationChoiceQuestion(clarification),
        unknowns: ["location"],
        facts: cleanArray(locationResult.matches).slice(0, 5).map((item) => ({ location: item })),
        draft: draftBase,
        originalMessage: baseText || rawText,
        clarification
      });
    }
    if (locationResult.status === "unknown") {
      const clarification = {
        ...locationResult.clarification,
        attemptCount: Number(locationResult.clarification?.attemptCount || 0) + 1
      };
      return collectingPlan({
        domain: "facility",
        pendingField: "location",
        question: locationChoiceQuestion(clarification, "לא הצלחתי לבחור מתוך האפשרויות. בחרו אחד מהאזורים האלה:"),
        unknowns: ["location"],
        facts: cleanArray(clarification.candidates).map((item) => ({ location: item.location })),
        draft: draftBase,
        originalMessage: baseText || rawText,
        clarification
      });
    }
    if (locationResult.status === "stale") {
      return collectingPlan({
        domain: "facility",
        pendingField: "location",
        question: "המיקום שהוצע כבר לא זמין בהגדרות. בחרו אזור או מחלקה מחדש.",
        unknowns: ["location_config_changed"],
        draft: { ...draftBase, zone: "" },
        originalMessage: baseText || rawText
      });
    }
    if (locationResult.status === "not_found") {
      return collectingPlan({
        domain: "facility",
        pendingField: "location",
        question: `לא מצאתי מיקום מותר בשם ${locationResult.candidates[0]}. באיזה אזור או מחלקה לפתוח את הקריאה?`,
        unknowns: ["location"],
        draft: draftBase,
        originalMessage: baseText || rawText
      });
    }
    return collectingPlan({
      domain: "facility",
      pendingField: "location",
      question: facilityLocationQuestion(baseText || rawText),
      unknowns: ["location"],
      draft: draftBase,
      originalMessage: baseText || rawText
    });
  }

  return collectingPlan({
    domain: "unresolved",
    pendingField: "domain",
    question: "איזה סוג קריאה לפתוח: כלי שינוע או אחזקת מבנה?",
    unknowns: ["domain"],
    draft: {
      subject: compactSubject(rawText),
      description: rawText,
      priority: selectedPriority
    },
    originalMessage: rawText
  });
}

export function createdInlineTicketAnswer(ticket = {}, result = {}) {
  const ticketNo = cleanText(result.ticketNumber || result.ticketNo, 80);
  const lines = [
    `נפתחה קריאה ${ticketNo || cleanText(ticket.id, 80)}`,
    "",
    ticket.track === "transport" ? "סוג: כלי שינוע / מלגזות" : "סוג: אחזקת מבנה ומתקנים",
    ticket.track === "transport" ? `כלי: ${ticket.asset}` : `קטגוריה: ${ticket.categoryLabel || ticket.category}`,
    ticket.track === "facility" ? `מקום: ${ticket.zone}` : "",
    `תיאור: ${ticket.subject}`
  ].filter((line) => line !== "");
  return lines.join("\n");
}
