import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";

const roleOf = (session = {}) => String(session.role || "").trim().toLowerCase();

const prompt = (text, workflow = AI_ASSIST_WORKFLOWS.general) => Object.freeze({ text, workflow });

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

export function aiAssistQuickPrompts(session = {}) {
  const role = roleOf(session);
  if (role === "admin") {
    return [
      prompt("סכם לי את הסיכונים החשובים", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("איפה יש עומס לפי מחלקה?", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("הסבר מה בחריגת SLA", AI_ASSIST_WORKFLOWS.slaExplanation),
      prompt("מה הפעולות הבאות?", AI_ASSIST_WORKFLOWS.nextActions)
    ];
  }
  if (role === "executive") {
    return [
      prompt("תן לי תמונת הנהלה קצרה", AI_ASSIST_WORKFLOWS.riskSummary),
      prompt("מה דורש החלטה ניהולית?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("איפה הסיכון הכי גדול לשירות?", AI_ASSIST_WORKFLOWS.riskSummary)
    ];
  }
  if (role === "tech") {
    return [
      prompt("מה הכי דחוף לטיפול?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("מה חסר כדי לסגור טיפול?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("הכן לי טיוטת עדכון", AI_ASSIST_WORKFLOWS.draftPreparation)
    ];
  }
  if (role === "cleaner") {
    return [
      prompt("מה צריך להשלים עכשיו?", AI_ASSIST_WORKFLOWS.nextActions),
      prompt("איפה יש תלונות פתוחות?", AI_ASSIST_WORKFLOWS.riskSummary)
    ];
  }
  if (role === "worker") {
    return [
      prompt("מה הסטטוס של הקריאות שלי?", AI_ASSIST_WORKFLOWS.general),
      prompt("מה נדרש ממני עכשיו?", AI_ASSIST_WORKFLOWS.nextActions)
    ];
  }
  return [
    prompt("מה דורש את תשומת לבי?", AI_ASSIST_WORKFLOWS.riskSummary),
    prompt("מה הפעולות הבאות?", AI_ASSIST_WORKFLOWS.nextActions),
    prompt("הכן לי טיוטת עדכון", AI_ASSIST_WORKFLOWS.draftPreparation)
  ];
}
