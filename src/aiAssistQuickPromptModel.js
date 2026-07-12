import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";

const roleOf = (session = {}) => String(session.role || "").trim().toLowerCase();

const prompt = (text, workflow = AI_ASSIST_WORKFLOWS.general) => Object.freeze({ text, workflow });

const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const compactCount = (value) => new Intl.NumberFormat("he-IL").format(asNumber(value));

const contextualPromptLimitForRole = (role) => {
  if (role === "worker" || role === "cleaner") return 1;
  if (role === "tech") return 2;
  return 3;
};

const uniquePrompts = (items = [], max = 5) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.text) continue;
    const key = `${item.text}::${item.workflow || AI_ASSIST_WORKFLOWS.general}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(prompt(item.text, item.workflow));
    if (out.length >= max) break;
  }
  return out;
};

export function aiAssistContextualPrompts(session = {}, context = {}) {
  const role = roleOf(session);
  const metrics = context?.metrics || {};
  const heatmap = Array.isArray(context?.bi?.heatmap) ? context.bi.heatmap : [];
  const topHeat = heatmap.find((row) => asNumber(row?.total) > 0);
  const items = [];

  if (["admin", "executive", "user"].includes(role)) {
    if (topHeat) {
      items.push(prompt(`נתח את העומס ב${topHeat.department}`, AI_ASSIST_WORKFLOWS.riskSummary));
    }
    if (asNumber(metrics.overdueTickets) > 0) {
      items.push(prompt(`הסבר את ${compactCount(metrics.overdueTickets)} חריגות ה-SLA`, AI_ASSIST_WORKFLOWS.slaExplanation));
    }
    if (asNumber(metrics.pendingApprovals) > 0) {
      items.push(prompt(`מה לאשר קודם מתוך ${compactCount(metrics.pendingApprovals)} ממתינות?`, AI_ASSIST_WORKFLOWS.nextActions));
    }
    if (asNumber(metrics.fleetDocsDue) > 0) {
      items.push(prompt(`אילו מסמכי כלי שינוע דחופים?`, AI_ASSIST_WORKFLOWS.riskSummary));
    }
    if (asNumber(metrics.pmDue) > 0) {
      items.push(prompt(`איזה טיפול תקופתי דחוף עכשיו?`, AI_ASSIST_WORKFLOWS.nextActions));
    }
  } else if (role === "tech") {
    if (asNumber(metrics.overdueTickets) > 0) {
      items.push(prompt("מה הכי מסכן SLA בטיפול שלי?", AI_ASSIST_WORKFLOWS.slaExplanation));
    }
    if (asNumber(metrics.pmDue) > 0) {
      items.push(prompt("איזה טיפול תקופתי לבצע קודם?", AI_ASSIST_WORKFLOWS.nextActions));
    }
    if (asNumber(metrics.openTickets) > 0) {
      items.push(prompt("סדר לי את העבודה לפי דחיפות", AI_ASSIST_WORKFLOWS.nextActions));
    }
  } else if (role === "cleaner") {
    if (asNumber(metrics.openTickets) > 0) {
      items.push(prompt("מה פתוח עכשיו בניקיון?", AI_ASSIST_WORKFLOWS.nextActions));
    }
  } else if (role === "worker") {
    if (asNumber(metrics.openTickets) > 0) {
      items.push(prompt("מה קורה עם הקריאות שלי?", AI_ASSIST_WORKFLOWS.general));
    }
  }

  return uniquePrompts(items, contextualPromptLimitForRole(role));
}

export function aiAssistWelcomeMessage(session = {}) {
  const role = roleOf(session);
  if (role === "admin") {
    return "שלום! אפשר לשאול על סיכונים מערכתיים, חריגות SLA, השבתות, עומסים לפי מחלקה והגדרות שדורשות בדיקה.";
  }
  if (role === "executive") {
    return "שלום! אפשר לקבל תמונת הנהלה קצרה: מה מסכן את השירות, איפה יש עומס, ומה דורש החלטה.";
  }
  if (role === "tech") {
    return "שלום! אפשר לשאול מה דחוף לטיפול, מה חסר להשלמה, ואיך לנסח עדכון קצר לקריאה.";
  }
  if (role === "cleaner") {
    return "שלום! אפשר לשאול על סבבי ניקיון, תלונות פתוחות ומה צריך להשלים עכשיו.";
  }
  if (role === "worker") {
    return "שלום! אפשר לשאול על הקריאות והבקשות שלך ומה נדרש ממך עכשיו.";
  }
  return "שלום! אפשר לשאול על הקריאות, האישורים והמשימות בתחום האחריות שלך.";
}

export function aiAssistQuickPrompts(session = {}, context = {}) {
  const role = roleOf(session);
  const contextual = aiAssistContextualPrompts(session, context);
  if (role === "admin") {
    return uniquePrompts([...contextual,
      prompt("סכם לי את הסיכונים החשובים", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("איפה יש עומס לפי מחלקה?", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("הסבר מה בחריגת SLA", AI_ASSIST_WORKFLOWS.slaExplanation),
      prompt("מה הפעולות הבאות?", AI_ASSIST_WORKFLOWS.nextActions)
    ]);
  }
  if (role === "executive") {
    return uniquePrompts([...contextual,
      prompt("תן לי תמונת הנהלה קצרה", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("מה דורש החלטה ניהולית?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("איפה הסיכון הכי גדול לשירות?", AI_ASSIST_WORKFLOWS.riskSummary)
    ]);
  }
  if (role === "tech") {
    return uniquePrompts([...contextual,
      prompt("מה הכי דחוף לטיפול?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("מה חסר כדי לסגור טיפול?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("הכן לי טיוטת עדכון", AI_ASSIST_WORKFLOWS.draftPreparation)
    ]);
  }
  if (role === "cleaner") {
    return uniquePrompts([...contextual,
      prompt("מה צריך להשלים עכשיו?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("איפה יש תלונות פתוחות?", AI_ASSIST_WORKFLOWS.riskSummary)
    ]);
  }
  if (role === "worker") {
    return uniquePrompts([...contextual,
      prompt("מה הסטטוס של הקריאות שלי?", AI_ASSIST_WORKFLOWS.general),
      prompt("מה נדרש ממני עכשיו?", AI_ASSIST_WORKFLOWS.nextActions)
    ]);
  }
  return uniquePrompts([...contextual,
    prompt("מה דורש את תשומת לבי?", AI_ASSIST_WORKFLOWS.riskSummary),
    prompt("מה הפעולות הבאות?", AI_ASSIST_WORKFLOWS.nextActions),
    prompt("הכן לי טיוטת עדכון", AI_ASSIST_WORKFLOWS.draftPreparation)
  ]);
}
