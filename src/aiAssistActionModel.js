const MAX_SUBJECT_CHARS = 80;
const MAX_DESCRIPTION_CHARS = 1200;
const HOUR = 3600000;

const cleanText = (value, limit = 240) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const cleanObject = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

const LOCATION_PATTERNS = [
  /(?:באזור|באיזור|במחלקת|במחסן|במבנה|בקו)\s+([^\n,.]+)/i,
  /(?:zone|area|department|warehouse|building)\s+([^\n,.]+)/i
];

function locationFromDraft(draft = {}) {
  const signalLocation = cleanText(draft.signals?.locationHint, 120);
  if (signalLocation) return signalLocation;
  const raw = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const match = LOCATION_PATTERNS.map((pattern) => raw.match(pattern)).find(Boolean);
  return match ? cleanText(match[1], 120) : "";
}

function subjectFromDraft(draft = {}) {
  const raw = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  if (!raw) return "";
  return raw.length > MAX_SUBJECT_CHARS ? `${raw.slice(0, MAX_SUBJECT_CHARS - 1).trim()}…` : raw;
}

function priorityFromSeverity(severity = "normal") {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "low") return "low";
  return "medium";
}

function ticketTrackForModule(module = "") {
  if (module === "transport") return "transport";
  if (["facility", "safety"].includes(module)) return "facility";
  return "";
}

function ticketCategoryForModule(module = "") {
  if (module === "transport") return "transport";
  if (module === "safety") return "safety";
  if (module === "facility") return "";
  return "";
}

function missingFieldsForTicketPayload(payload = {}, draft = {}) {
  const missing = [];
  if (!payload.track) missing.push("track");
  if (!payload.subject) missing.push("subject");
  if (!payload.description) missing.push("description");
  if (payload.track === "facility" && !payload.zone) missing.push("zone");
  if (payload.track === "transport" && !payload.forkliftId) missing.push("forkliftId");
  if (payload.track === "transport" && !payload.downtimeType) missing.push("downtimeType");
  if (draft.module === "unknown") missing.push("module");
  return [...new Set(missing)];
}

export function buildAiTicketCreatePayload({ draft = {}, user = {}, now = Date.now() } = {}) {
  const module = cleanText(draft.module, 40);
  const track = ticketTrackForModule(module);
  const location = locationFromDraft(draft);
  const subject = subjectFromDraft(draft);
  const description = cleanText(draft.rawText, MAX_DESCRIPTION_CHARS);
  const priority = priorityFromSeverity(draft.severity);
  const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const payload = {
    track,
    subject,
    category: ticketCategoryForModule(module),
    categoryLabel: "",
    priority,
    zone: location,
    asset: "",
    forkliftId: "",
    downtimeType: "",
    description,
    status: "new",
    assignee: "",
    routedTech: track === "transport" ? true : undefined,
    supplier: "",
    createdBy: {
      id: cleanText(user.id || user.authUserId || user.workerNo, 120),
      name: cleanText(user.name, 120),
      role: cleanText(user.role, 40),
      dept: cleanText(user.dept || user.department, 120),
      phone: cleanText(user.phone, 80),
      email: cleanText(user.email, 160)
    },
    createdAt,
    updatedAt: createdAt,
    dueAt: createdAt + (priority === "high" ? 8 : 48) * HOUR,
    hasPhoto: false,
    closure: null,
    log: [{
      at: createdAt,
      by: cleanText(user.name, 120),
      byRole: cleanText(user.role, 40),
      text: "טיוטת קריאה הוכנה על ידי AI וממתינה לאישור משתמש",
      kind: "ai_draft"
    }],
    ai: {
      drafted: true,
      source: "ai_assist",
      draftVersion: Number(draft.version || 1)
    }
  };
  return payload;
}

export function buildAiAssistActionProposals({ draft = {}, user = {}, now = Date.now() } = {}) {
  const safeDraft = cleanObject(draft);
  if (safeDraft.action !== "draft_ticket") return [];
  const payload = buildAiTicketCreatePayload({ draft: safeDraft, user, now });
  const missingFields = missingFieldsForTicketPayload(payload, safeDraft);
  const status = missingFields.length ? "needs_human_input" : "ready_for_confirmation";
  return [{
    id: "create_ticket",
    type: "ticket.create",
    label: "פתיחת קריאה",
    status,
    requiresConfirmation: true,
    writesData: false,
    writePolicy: "human_confirmation_required",
    missingFields,
    payload,
    execute: {
      method: "POST",
      path: "/api/tickets",
      bodyField: "ticket"
    },
    safety: {
      deterministic: true,
      providerTextTrusted: false,
      serverMustRevalidate: true,
      auditRequired: true
    }
  }];
}
