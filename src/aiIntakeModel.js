export const AI_INTAKE_MODULES = Object.freeze([
  "facility",
  "transport",
  "cleaning",
  "ppe",
  "safety",
  "task",
  "supplier",
  "system_issue",
  "unknown"
]);

export const AI_INTAKE_SEVERITIES = Object.freeze(["low", "normal", "high", "critical"]);

export const AI_INTAKE_ACTIONS = Object.freeze([
  "ask_clarification",
  "draft_ticket",
  "draft_cleaning_report",
  "draft_ppe_request",
  "draft_task",
  "route_to_human",
  "no_action"
]);

const HEBREW_KEYWORDS = {
  transport: ["מלגזה", "רכב", "משאית", "כלי", "שינוע", "מצבר", "טעינה", "פנצ'ר", "צמיג"],
  cleaning: ["ניקיון", "נקיון", "לכלוך", "מלוכלך", "מלוכלכת", "מלוכלכים", "פסולת", "אשפה", "זבל", "שירותים", "רטוב", "נזילה", "ריח"],
  ppe: ["ביגוד", "נעליים", "נעלי", "קסדה", "כפפות", "אפוד", "מידה"],
  safety: ["סכנה", "מסוכן", "אש", "עשן", "חשמל", "ניצוץ", "פציעה", "חירום"],
  facility: ["דלת", "שער", "מזגן", "תאורה", "חשמל", "מים", "נזילה", "קיר", "רצפה", "בניין"],
  supplier: ["ספק", "קבלן", "חשבונית", "הזמנה"],
  task: ["משימה", "פגישה", "תזכורת", "בדיקה"]
};

const ENGLISH_KEYWORDS = {
  transport: ["forklift", "truck", "vehicle", "battery", "charge", "tire", "transport"],
  cleaning: ["cleaning", "dirty", "trash", "spill", "wet", "toilet", "smell"],
  ppe: ["ppe", "clothing", "shoes", "helmet", "gloves", "vest", "size"],
  safety: ["danger", "unsafe", "fire", "smoke", "electric", "spark", "injury", "emergency"],
  facility: ["door", "gate", "light", "electric", "water", "wall", "floor", "building"],
  supplier: ["supplier", "contractor", "invoice", "order"],
  task: ["task", "meeting", "reminder", "check"]
};

const RUSSIAN_KEYWORDS = {
  transport: ["техника", "техники", "транспорт", "транспорта", "погрузчик", "погрузчика", "машина", "машины", "документы техники", "документы транспорта"],
  cleaning: ["уборка", "грязно", "грязный", "грязная", "мусор", "туалет", "запах"],
  ppe: ["одежда", "спецодежда", "обувь", "каска", "перчатки", "жилет", "размер"],
  safety: ["опасно", "опасность", "пожар", "дым", "искра", "травма", "аварийно"],
  facility: ["дверь", "двери", "ручка", "ручки", "ворота", "свет", "электрика", "вода", "стена", "пол", "здание", "холодильник", "холодильника", "холодильная", "холодильной", "комната", "комнате"],
  supplier: ["поставщик", "подрядчик", "счёт", "счет", "заказ"],
  task: ["задача", "встреча", "напоминание", "проверка"]
};

const CRITICAL_WORDS = ["סכנה", "מסוכן", "אש", "עשן", "ניצוץ", "פציעה", "חירום", "danger", "unsafe", "fire", "smoke", "spark", "injury", "emergency"];
const HIGH_WORDS = ["תקוע", "מושבת", "לא עובד", "דחוף", "חוסם", "stuck", "down", "urgent", "blocked", "not working"];
const LOCATION_PATTERNS = [
  /(?:באזור|באיזור|במחלקת|במחסן|במבנה|בקו)\s+([^\n,.]+)/i,
  /(?:zone|area|department|warehouse|building)\s+([^\n,.]+)/i,
  /(?:в\s+зоне|в\s+отделе|на\s+складе|в\s+складе|в\s+здании|в\s+корпусе|в\s+комнате|в|на|у|около|возле)\s+([^\n,.]+)/iu
];
const LOCATION_PROBLEM_ONLY_RE = /^(?:לא\s+עובד|לא\s+עובדת|שבור|שבורה|שבורים|תקול|תקולה|broken|not\s+working|не\s+работ|сломал)/iu;

const KEYWORDS_BY_MODULE = Object.freeze(
  AI_INTAKE_MODULES.reduce((acc, module) => {
    acc[module] = [
      ...(HEBREW_KEYWORDS[module] || []),
      ...(ENGLISH_KEYWORDS[module] || []),
      ...(RUSSIAN_KEYWORDS[module] || [])
    ];
    return acc;
  }, {})
);

const STRONG_TASK_WORDS = Object.freeze(["משימה", "פגישה", "תזכורת", "task", "meeting", "reminder"]);

export function normalizeAiIntakeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanLocationHint(value = "") {
  const location = normalizeAiIntakeText(value);
  if (!location || LOCATION_PROBLEM_ONLY_RE.test(location.toLowerCase())) return "";
  return location;
}

export function detectAiIntakeModule(text = "") {
  const normalized = normalizeAiIntakeText(text).toLowerCase();
  if (!normalized) return "unknown";
  if (STRONG_TASK_WORDS.some((word) => normalized.includes(word.toLowerCase()))) return "task";
  if (/ניקיון|נקיון|לכלוך|מלוכלך|מלוכלכת|מלוכלכים|פסולת|אשפה|זבל|שירותים|ריח|dirty|trash|garbage|toilet|smell/i.test(normalized)) return "cleaning";
  const scores = Object.fromEntries(AI_INTAKE_MODULES.map((module) => [module, 0]));
  for (const [module, words] of Object.entries(KEYWORDS_BY_MODULE)) {
    for (const word of words) {
      if (normalized.includes(word.toLowerCase())) scores[module] += 1;
    }
  }
  const best = Object.entries(scores)
    .filter(([module]) => module !== "unknown")
    .sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "unknown";
}

export function hasAiInformationalIntent(text = "") {
  const normalized = normalizeAiIntakeText(text).toLowerCase();
  if (!normalized) return false;
  const asksQuestion = /[?？]/u.test(normalized)
    || /\b(why|what|how|when|where|explain)\b/i.test(normalized)
    || /(почему|зачем|что значит|что такое|как |когда|где|объясни|поясни)/iu.test(normalized)
    || /(למה|מדוע|מה זה|מה המשמעות|איך|מתי|איפה|הסבר)/iu.test(normalized);
  const asksWrite = /(создай|создать|открой|פתח|צור|תפתח|create|open|update|change|עדכן|תעדכן|закрой|סגור|close|delete|удали)/iu.test(normalized);
  return asksQuestion && !asksWrite;
}

export function detectAiIntakeSeverity(text = "") {
  const normalized = normalizeAiIntakeText(text).toLowerCase();
  if (!normalized) return "normal";
  if (CRITICAL_WORDS.some((word) => normalized.includes(word.toLowerCase()))) return "critical";
  if (HIGH_WORDS.some((word) => normalized.includes(word.toLowerCase()))) return "high";
  return "normal";
}

export function extractAiIntakeSignals(text = "") {
  const normalized = normalizeAiIntakeText(text);
  const lower = normalized.toLowerCase();
  const locationMatch = LOCATION_PATTERNS.map((pattern) => normalized.match(pattern)).find(Boolean);
  const locationHint = locationMatch ? cleanLocationHint(locationMatch[1]) : "";
  return {
    hasPhotoHint: /תמונה|צילום|photo|picture|image/i.test(normalized),
    hasQrHint: /qr|קוד|ברקוד/i.test(normalized),
    hasPeopleRisk: /אנשים|עובדים|סביב|near people|workers/i.test(normalized),
    hasProductionImpact: /ייצור|קו|חוסם|השבתה|production|line|blocked/i.test(normalized),
    hasExactLocation: Boolean(locationHint),
    locationHint,
    hasAssetHint: /#?\d{2,}|מלגזה|רכב|משאית|forklift|truck|vehicle/i.test(normalized),
    riskWords: [...CRITICAL_WORDS, ...HIGH_WORDS].filter((word) => lower.includes(word.toLowerCase()))
  };
}

export function aiIntakeMissingInfo(draft = {}) {
  const missing = [];
  if (!draft.rawText) missing.push("description");
  if (!draft.signals?.hasExactLocation) missing.push("location");
  if (!draft.signals?.hasAssetHint && ["transport", "ppe"].includes(draft.module)) missing.push("asset_or_worker");
  if (!draft.signals?.hasPhotoHint && ["facility", "transport", "cleaning", "safety"].includes(draft.module)) missing.push("photo_optional");
  if (draft.module === "unknown") missing.push("module");
  if (draft.severity === "critical" && !draft.signals?.hasPeopleRisk) missing.push("people_risk");
  return missing;
}

export function aiIntakeClarifyingQuestions(draft = {}) {
  const questions = [];
  const missing = new Set(draft.missingInfo || aiIntakeMissingInfo(draft));
  if (missing.has("module")) questions.push("לאיזה תחום זה שייך: אחזקה, כלי שינוע, ניקיון, ביגוד, בטיחות או משהו אחר?");
  if (missing.has("location")) questions.push("איפה בדיוק הבעיה נמצאת?");
  if (missing.has("asset_or_worker")) questions.push("לאיזה כלי/עובד זה קשור?");
  if (missing.has("people_risk")) questions.push("האם יש אנשים ליד המפגע או שהאזור כבר נסגר?");
  if (missing.has("photo_optional")) questions.push("אפשר לצרף תמונה כדי לקצר את הטיפול?");
  return questions;
}

export function aiIntakeActionForModule(module = "unknown") {
  if (module === "cleaning") return "draft_cleaning_report";
  if (module === "ppe") return "draft_ppe_request";
  if (module === "task") return "draft_task";
  if (module === "unknown") return "ask_clarification";
  return "draft_ticket";
}

export function buildAiIntakeDraft(input = {}, now = Date.now()) {
  const rawText = normalizeAiIntakeText(input.rawText || input.text || input.description);
  const module = AI_INTAKE_MODULES.includes(input.module) && input.module !== "unknown"
    ? input.module
    : detectAiIntakeModule(rawText);
  const severity = AI_INTAKE_SEVERITIES.includes(input.severity)
    ? input.severity
    : detectAiIntakeSeverity(rawText);
  const signals = extractAiIntakeSignals(rawText);
  const informationalIntent = hasAiInformationalIntent(rawText);
  const base = {
    version: 1,
    createdAt: now,
    source: input.source || "ui",
    language: input.language || "he",
    actor: input.actor || { type: "unknown" },
    rawText,
    module,
    severity,
    confidence: module === "unknown" ? "low" : "medium",
    signals,
    action: informationalIntent ? "no_action" : aiIntakeActionForModule(module),
    writePolicy: "human_confirmation_required",
    allowedToWrite: false
  };
  const missingInfo = informationalIntent ? [] : aiIntakeMissingInfo(base);
  const clarifyingQuestions = aiIntakeClarifyingQuestions({ ...base, missingInfo });
  return {
    ...base,
    missingInfo,
    clarifyingQuestions,
    userReply: buildAiIntakeUserReply({ ...base, missingInfo, clarifyingQuestions }),
    audit: {
      required: true,
      eventType: "ai_intake_draft",
      safe: true
    }
  };
}

export function buildAiIntakeUserReply(draft = {}) {
  if (!draft.rawText) return "כתבו בקצרה מה קרה, איפה זה נמצא, ואם יש סכנה לאנשים.";
  if (draft.action === "no_action") return "אענה לפי ההקשר הזמין בלי לבצע שינוי במערכת.";
  if (draft.severity === "critical") {
    return "זיהיתי חשד לאירוע דחוף/מסוכן. נא להתרחק מהאזור אם יש סכנה, ולענות על שאלות ההבהרה לפני פתיחת הקריאה.";
  }
  if ((draft.clarifyingQuestions || []).length > 0) {
    return "אני צריך עוד כמה פרטים כדי לפתוח פנייה מדויקת.";
  }
  return "יש מספיק מידע להכנת טיוטה לאישור.";
}

export function aiIntakeOutputSchema() {
  return {
    version: 1,
    required: [
      "module",
      "severity",
      "confidence",
      "signals",
      "missingInfo",
      "clarifyingQuestions",
      "action",
      "userReply",
      "writePolicy"
    ],
    modules: AI_INTAKE_MODULES,
    severities: AI_INTAKE_SEVERITIES,
    actions: AI_INTAKE_ACTIONS,
    writePolicy: "human_confirmation_required"
  };
}
