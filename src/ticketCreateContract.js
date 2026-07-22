export const TICKET_TRACKS = Object.freeze({
  facility: "facility",
  transport: "transport"
});

export const DEFAULT_TRANSPORT_DOWNTIME_LEVELS = Object.freeze([
  { id: "has_replacement", label: "יש תחליף", desc: "הכלי מושבת אך קיים תחליף זמין", color: "#16A34A", prio: "medium", oos: false },
  { id: "minor", label: "תקלה שאינה מוציאה מכלל שימוש", desc: "ניתן להמשיך לעבוד · בדיקה/תחזוקה", color: "#CA8A04", prio: "low", oos: false },
  { id: "critical", label: "תקלה קריטית — אין תחליף", desc: "הכלי מושבת ואין תחליף", color: "#DC2626", prio: "high", oos: true }
]);

export const SYSTEM_DOWNTIME_NEEDS_TRIAGE = Object.freeze({
  id: "needs_triage",
  label: "נדרש אבחון",
  desc: "דווחה תקלה, מצב הכלי טרם נקבע",
  color: "#64748B",
  prio: "medium",
  requiresTriage: true,
  system: true
});

export const TICKET_CREATE_FIELD_CONTRACT = Object.freeze({
  id: Object.freeze(["derived", "not_user_askable"]),
  num: Object.freeze(["derived", "not_user_askable"]),
  ticketNumber: Object.freeze(["derived", "not_user_askable"]),
  track: Object.freeze(["required_blocking", "inferable"]),
  subject: Object.freeze(["required_blocking", "inferable"]),
  description: Object.freeze(["required_blocking", "inferable"]),
  category: Object.freeze(["required_blocking", "defaulted", "inferable"]),
  priority: Object.freeze(["required_blocking", "safety_relevant"]),
  asset: Object.freeze(["optional", "inferable"]),
  forkliftId: Object.freeze(["required_blocking", "inferable", "safety_relevant"]),
  zone: Object.freeze(["defaulted", "optional"]),
  downtimeType: Object.freeze(["required_blocking", "defaulted", "safety_relevant"]),
  department: Object.freeze(["derived", "not_user_askable"]),
  reporter: Object.freeze(["derived", "not_user_askable"]),
  assignee: Object.freeze(["optional", "derived", "not_user_askable"]),
  supplier: Object.freeze(["optional", "derived", "not_user_askable"]),
  status: Object.freeze(["defaulted", "derived", "not_user_askable"]),
  timestamps: Object.freeze(["derived", "not_user_askable"]),
  auditMetadata: Object.freeze(["derived", "not_user_askable"])
});

const cleanText = (value, limit = 1000) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanArray = (value) => Array.isArray(value) ? value : [];
const lookupText = (value = "") => cleanText(value, 800).toLowerCase();

function configuredDowntimeLevels(config = {}, fallbackLevels = []) {
  const fallback = cleanArray(fallbackLevels).length ? fallbackLevels : DEFAULT_TRANSPORT_DOWNTIME_LEVELS;
  const configured = cleanArray(config?.downtimeLevels).length ? config.downtimeLevels : fallback;
  return cleanArray(configured).filter((level) => level?.id !== SYSTEM_DOWNTIME_NEEDS_TRIAGE.id);
}

export function downtimeLevelsWithSystemDefaults(config = {}, fallbackLevels = []) {
  return [SYSTEM_DOWNTIME_NEEDS_TRIAGE, ...configuredDowntimeLevels(config, fallbackLevels)];
}

export function transportCreateDowntimeLevels(config = {}, fallbackLevels = []) {
  return configuredDowntimeLevels(config, fallbackLevels);
}

export function downtimeLevelOf(id = "", config = {}, fallbackLevels = []) {
  const cleanId = cleanText(id, 80);
  return downtimeLevelsWithSystemDefaults(config, fallbackLevels).find((level) => level?.id === cleanId)
    || fallbackLevels.find((level) => level?.id === cleanId)
    || { id: cleanId, label: cleanId || "-", desc: "", color: "#6B7280", prio: "medium" };
}

export function isDowntimeOutOfService(level = {}) {
  return level?.oos === true;
}

export function isDowntimeNeedsTriage(level = {}) {
  return level?.requiresTriage === true || level?.id === SYSTEM_DOWNTIME_NEEDS_TRIAGE.id;
}

export function transportPriorityForDowntimeType(id = "", config = {}, fallbackLevels = []) {
  const cleanId = cleanText(id, 80);
  if (!cleanId) return "";
  const level = transportCreateDowntimeLevels(config, fallbackLevels).find((item) => item?.id === cleanId)
    || fallbackLevels.find((item) => item?.id === cleanId);
  return cleanText(level?.prio, 40);
}

export function transportDowntimeTypeFromText(text = "", config = {}, fallbackLevels = []) {
  const raw = lookupText(text);
  if (!raw) return "";
  const levels = transportCreateDowntimeLevels(config, fallbackLevels);
  const byExplicitText = levels.find((level) => {
    const haystack = [level?.id, level?.label, level?.desc]
      .map((value) => lookupText(value))
      .filter(Boolean);
    return haystack.some((value) => raw.includes(value));
  });
  if (byExplicitText?.id) return cleanText(byExplicitText.id, 80);

  const critical = levels.find((level) => level?.id === "critical")
    || levels.find((level) => level?.oos === true && cleanText(level?.prio, 40) === "high")
    || levels.find((level) => level?.oos === true);
  const replacement = levels.find((level) => level?.id === "has_replacement")
    || levels.find((level) => level?.oos === false && cleanText(level?.prio, 40) === "medium");
  const minor = levels.find((level) => level?.id === "minor")
    || levels.find((level) => level?.oos === false && cleanText(level?.prio, 40) === "low");

  if (/אין\s+(?:תחליף|גיבוי)|ללא\s+(?:תחליף|גיבוי)|מושבת(?:ת)?\s+ואין|הכלי\s+מושבת|מוציא(?:ה)?\s+מכלל\s+שימוש|השבתה\s+קריטית|out\s+of\s+service|no\s+(?:replacement|spare|backup)|critical\s+downtime/i.test(raw)) {
    return cleanText(critical?.id, 80);
  }
  if (/יש\s+(?:תחליף|גיבוי)|קיים\s+(?:תחליף|גיבוי)|תחליף\s+זמין|גיבוי\s+זמין|with\s+replacement|replacement\s+available|backup\s+available|spare\s+available/i.test(raw)) {
    return cleanText(replacement?.id, 80);
  }
  if (/ניתן\s+להמשיך\s+לעבוד|אפשר\s+להמשיך\s+לעבוד|לא\s+מוציא(?:ה)?\s+מכלל\s+שימוש|לא\s+מושבת|minor\s+downtime|minor|can\s+continue/i.test(raw)) {
    return cleanText(minor?.id, 80);
  }
  if (/תקלה|בעיה|לא\s+עובד|לא\s+עובדת|שבור|שבורה|שבורים|שבורות|broken|not\s+working|fault|problem|не\s+работ|сломал|полом|проблем/i.test(raw)) {
    return cleanText(minor?.id, 80);
  }
  return "";
}

export function ticketTrackForCreate(input = {}) {
  const track = cleanText(input.track, 40);
  if (track === TICKET_TRACKS.transport || (!track && cleanText(input.forkliftId || input.forklift_id, 160))) return TICKET_TRACKS.transport;
  return TICKET_TRACKS.facility;
}

export function missingTicketCreateFields(input = {}) {
  const ticket = input && typeof input === "object" ? input : {};
  const track = ticketTrackForCreate(ticket);
  const missing = [];
  if (!cleanText(ticket.subject || ticket.title, 240)) missing.push("subject");
  if (!cleanText(ticket.description || ticket.desc, 1600)) missing.push("description");
  if (!cleanText(ticket.priority, 40)) missing.push("priority");
  if (track === TICKET_TRACKS.facility && !cleanText(ticket.category || ticket.cat, 120)) missing.push("category");
  if (track === TICKET_TRACKS.transport && !cleanText(ticket.forkliftId || ticket.forklift_id, 160)) missing.push("forkliftId");
  if (track === TICKET_TRACKS.transport && !cleanText(ticket.downtimeType || ticket.downtime_type, 80)) missing.push("downtimeType");
  return [...new Set(missing)];
}

export function ticketCreateContractSummary(config = {}, fallbackDowntimeLevels = []) {
  return {
    version: 1,
    fields: TICKET_CREATE_FIELD_CONTRACT,
    downtimeLevels: transportCreateDowntimeLevels(config, fallbackDowntimeLevels).map((level) => ({
      id: cleanText(level.id, 80),
      label: cleanText(level.label, 120),
      desc: cleanText(level.desc, 240),
      color: cleanText(level.color, 40) || "#64748B",
      prio: cleanText(level.prio, 40) || "medium",
      ...(level.oos === true ? { oos: true } : {}),
      ...(level.requiresTriage === true ? { requiresTriage: true } : {})
    })),
    systemDowntimeLevels: [SYSTEM_DOWNTIME_NEEDS_TRIAGE]
  };
}
