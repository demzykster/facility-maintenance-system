import { AI_ASSIST_WORKFLOWS } from "./aiAssistWorkflowModel.js";

const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const compactCount = (value) => new Intl.NumberFormat("he-IL").format(asNumber(value));

const safeLabel = (value, fallback = "") => String(value || fallback || "").trim();

function heatmapRiskLine(row = {}) {
  const risk = row.primaryRisk || null;
  if (risk?.label && asNumber(risk.value) > 0) {
    return `מוקד הסיכון המרכזי הוא ${risk.label} (${compactCount(risk.value)}).`;
  }
  return asNumber(row.total) > 0
    ? `יש ${compactCount(row.total)} קריאות פתוחות ללא מוקד סיכון חריג אחד.`
    : "אין כרגע עומס פתוח בתחום הזה.";
}

function topHeatmapRows(rows = []) {
  return rows
    .filter((row) => asNumber(row?.total) > 0)
    .slice(0, 3)
    .map((row) => {
      const name = safeLabel(row.name, row.department || "תחום");
      return `${name}: ${compactCount(row.total)} פתוחות; ${heatmapRiskLine(row)}`;
    });
}

export function ticketAiPrompt({ ticket = {}, labels = {} } = {}) {
  const number = safeLabel(labels.number, ticket.number || ticket.no || ticket.id || "—");
  const subject = safeLabel(ticket.subject, "קריאה");
  const status = safeLabel(labels.status, ticket.status || "לא ידוע");
  const priority = safeLabel(labels.priority, ticket.priority || "לא ידוע");
  const track = safeLabel(labels.track, ticket.track || "כללי");
  const category = safeLabel(labels.category, ticket.categoryLabel || ticket.category || "");
  const asset = safeLabel(labels.asset, ticket.asset || "");
  const assignee = safeLabel(labels.assignee, ticket.assignee || ticket.supplier || "טרם שויך");
  const waitReason = safeLabel(labels.waitReason, "");
  const age = safeLabel(labels.age, "");
  const slaBreached = labels.slaBreached === true;
  const workflow = slaBreached ? AI_ASSIST_WORKFLOWS.slaExplanation : AI_ASSIST_WORKFLOWS.nextActions;
  const contextParts = [
    `מסלול: ${track}`,
    `סטטוס: ${status}`,
    `עדיפות: ${priority}`,
    category ? `קטגוריה: ${category}` : "",
    asset ? `ציוד/אזור: ${asset}` : "",
    `אחראי: ${assignee}`,
    waitReason ? `סיבת המתנה: ${waitReason}` : "",
    age ? `זמן/גיל: ${age}` : ""
  ].filter(Boolean);
  const slaLine = slaBreached
    ? "מסומנת חריגת SLA או חשיפת SLA."
    : "לא מסומנת חריגת SLA כרגע.";

  return Object.freeze({
    workflow,
    text: `נתח את קריאה #${number}: "${subject}". ${contextParts.join("; ")}. ${slaLine} הסבר מה הסיכון, מה חסר כדי להתקדם, ומה 3 הפעולות הבטוחות הבאות.`
  });
}

export function fleetAiPrompt({ unit = {}, labels = {} } = {}) {
  const code = safeLabel(labels.code, unit.code || unit.license || unit.id || "—");
  const description = safeLabel(labels.description, unit.description || unit.type || unit.model || "כלי שינוע");
  const supplier = safeLabel(labels.supplier, unit.supplier || "ללא ספק");
  const departments = safeLabel(labels.departments, "");
  const documentStatus = safeLabel(labels.documentStatus, "לא ידוע");
  const serviceStatus = safeLabel(labels.serviceStatus, "לא ידוע");
  const health = safeLabel(labels.health, "");
  const downtime = safeLabel(labels.downtime, "");
  const recommendation = safeLabel(labels.recommendation, "");
  const openTickets = asNumber(labels.openTickets);
  const totalTickets = asNumber(labels.totalTickets);
  const hasDocumentRisk = /פג|חסר|קרוב|expired|missing|soon/i.test(documentStatus);
  const hasServiceRisk = !/פעיל|תקין|ok/i.test(serviceStatus);
  const hasRisk = openTickets > 0 || hasDocumentRisk || hasServiceRisk || !!downtime;
  const ticketLine = openTickets > 0
    ? `${compactCount(openTickets)} קריאות פתוחות${totalTickets > openTickets ? ` מתוך ${compactCount(totalTickets)} קריאות קשורות` : ""}`
    : "אין קריאות פתוחות";
  const contextParts = [
    `תיאור: ${description}`,
    `ספק: ${supplier}`,
    departments ? `מחלקות: ${departments}` : "",
    `מסמכים: ${documentStatus}`,
    `מצב שירות: ${serviceStatus}`,
    health ? `בריאות כלי: ${health}` : "",
    ticketLine,
    downtime ? `השבתה מצטברת: ${downtime}` : "",
    recommendation ? `המלצת מערכת: ${recommendation}` : ""
  ].filter(Boolean);

  return Object.freeze({
    workflow: hasRisk ? AI_ASSIST_WORKFLOWS.riskSummary : AI_ASSIST_WORKFLOWS.nextActions,
    text: `נתח את כלי שינוע ${code}. ${contextParts.join("; ")}. הסבר מה הסיכון התפעולי, מה כדאי לבדוק במסמכים/קריאות/טיפול מונע, ומה 3 הפעולות הבטוחות הבאות.`
  });
}

export function ppeDashboardAiPrompt({ labels = {} } = {}) {
  const activeItems = asNumber(labels.activeItems);
  const pendingRequests = asNumber(labels.pendingRequests);
  const lowItems = asNumber(labels.lowItems);
  const outItems = asNumber(labels.outItems);
  const reorderItems = asNumber(labels.reorderItems);
  const reorderUnits = asNumber(labels.reorderUnits);
  const openOrders = asNumber(labels.openOrders);
  const monthlyIssues = asNumber(labels.monthlyIssues);
  const flaggedIssues = asNumber(labels.flaggedIssues);
  const employeeCharge = safeLabel(labels.employeeCharge, "");
  const topDeficits = Array.isArray(labels.topDeficits) ? labels.topDeficits.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const recommendations = Array.isArray(labels.recommendations) ? labels.recommendations.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const hasRisk = pendingRequests > 0 || lowItems > 0 || outItems > 0 || reorderItems > 0 || flaggedIssues > 0;
  const riskLine = hasRisk
    ? [
      lowItems ? `${compactCount(lowItems)} פריטים בחוסר` : "",
      outItems ? `${compactCount(outItems)} פריטים אזלו` : "",
      pendingRequests ? `${compactCount(pendingRequests)} בקשות ממתינות` : "",
      reorderItems ? `${compactCount(reorderItems)} פריטים להזמנה (${compactCount(reorderUnits)} יחידות)` : "",
      flaggedIssues ? `${compactCount(flaggedIssues)} חריגות הנפקה` : ""
    ].filter(Boolean).join("; ")
    : "אין כרגע חוסרים פתוחים או בקשות ממתינות.";
  const contextParts = [
    `${compactCount(activeItems)} פריטי קטלוג פעילים`,
    riskLine,
    openOrders ? `${compactCount(openOrders)} הזמנות רכש פתוחות` : "אין הזמנות רכש פתוחות",
    `${compactCount(monthlyIssues)} הנפקות בתקופה`,
    employeeCharge ? `חיוב עובדים בתקופה: ${employeeCharge}` : "",
    topDeficits.length ? `חוסרים בולטים: ${topDeficits.join("; ")}` : "",
    recommendations.length ? `המלצות מערכת: ${recommendations.join("; ")}` : ""
  ].filter(Boolean);

  return Object.freeze({
    workflow: hasRisk ? AI_ASSIST_WORKFLOWS.riskSummary : AI_ASSIST_WORKFLOWS.nextActions,
    text: `נתח את לוח ביגוד עובדים. ${contextParts.join("; ")}. הסבר מה הסיכון למלאי/הנפקות/הזמנות, מה צריך לבדוק לפני פעולה, ומה 3 הפעולות הבטוחות הבאות.`
  });
}

export function biHeatmapAiPrompt({ rows = [], row = null, cell = null } = {}) {
  const selectedRow = row || null;
  const selectedCell = cell || null;
  const rowName = selectedRow ? safeLabel(selectedRow.name, selectedRow.department || "התחום שנבחר") : "";
  const cellLabel = selectedCell ? safeLabel(selectedCell.label, selectedCell.key || "מדד") : "";

  if (selectedRow && selectedCell) {
    return Object.freeze({
      workflow: AI_ASSIST_WORKFLOWS.riskSummary,
      text: `נתח את תא מפת החום "${cellLabel}" בתחום "${rowName}": למה זה חשוב, מה עלול לעכב טיפול, ומה 3 הפעולות הבטוחות הבאות למנהל לבדוק?`
    });
  }

  if (selectedRow) {
    return Object.freeze({
      workflow: AI_ASSIST_WORKFLOWS.riskSummary,
      text: `נתח את העומס בתחום "${rowName}" לפי מפת החום. ${heatmapRiskLine(selectedRow)} הסבר מה הסיכון התפעולי ומה כדאי לבדוק קודם.`
    });
  }

  const topRows = topHeatmapRows(rows);
  const contextLine = topRows.length
    ? `מוקדי עומס בולטים: ${topRows.join(" ")}`
    : "אין כרגע עומס פתוח בולט במפת החום.";

  return Object.freeze({
    workflow: AI_ASSIST_WORKFLOWS.riskSummary,
    text: `נתח את מפת חום הקריאות. ${contextLine} תן סיכום קצר: איפה מצטבר עומס, מה הסיכון המרכזי, ומה 3 הפעולות הבטוחות הבאות.`
  });
}
