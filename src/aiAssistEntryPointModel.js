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

export function cleaningDashboardAiPrompt({ labels = {} } = {}) {
  const zones = asNumber(labels.zones);
  const doneRounds = asNumber(labels.doneRounds);
  const totalRounds = asNumber(labels.totalRounds);
  const actionableRounds = asNumber(labels.actionableRounds);
  const missedRounds = asNumber(labels.missedRounds);
  const pendingComplaints = asNumber(labels.pendingComplaints);
  const openComplaints = asNumber(labels.openComplaints);
  const escalatedComplaints = asNumber(labels.escalatedComplaints);
  const absentCleaners = Array.isArray(labels.absentCleaners) ? labels.absentCleaners.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const unassignedZones = Array.isArray(labels.unassignedZones) ? labels.unassignedZones.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const riskZones = Array.isArray(labels.riskZones) ? labels.riskZones.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const hasRisk = actionableRounds > 0 || missedRounds > 0 || pendingComplaints > 0 || openComplaints > 0 || absentCleaners.length > 0 || unassignedZones.length > 0;
  const statusLine = hasRisk
    ? [
      actionableRounds ? `${compactCount(actionableRounds)} סבבים דורשים פעולה` : "",
      missedRounds ? `${compactCount(missedRounds)} סבבים פוספסו` : "",
      pendingComplaints ? `${compactCount(pendingComplaints)} דיווחים ממתינים לאישור` : "",
      openComplaints ? `${compactCount(openComplaints)} דיווחים פתוחים` : "",
      escalatedComplaints ? `${compactCount(escalatedComplaints)} דיווחים הועברו להנהלה` : ""
    ].filter(Boolean).join("; ")
    : "אין כרגע סבבים באיחור או דיווחים פתוחים.";
  const contextParts = [
    `${compactCount(zones)} אזורי ניקיון`,
    `${compactCount(doneRounds)}/${compactCount(totalRounds)} סבבים בוצעו היום`,
    statusLine,
    absentCleaners.length ? `עובדים בחופשה/חסרים: ${absentCleaners.join(", ")}` : "",
    unassignedZones.length ? `אזורים ללא אחראי: ${unassignedZones.join(", ")}` : "",
    riskZones.length ? `אזורים לבדיקה ראשונה: ${riskZones.join("; ")}` : ""
  ].filter(Boolean);

  return Object.freeze({
    workflow: hasRisk ? AI_ASSIST_WORKFLOWS.riskSummary : AI_ASSIST_WORKFLOWS.nextActions,
    text: `נתח את בקרת ניקיון להיום. ${contextParts.join("; ")}. הסבר מה הסיכון התפעולי, מי/מה כדאי לבדוק לפני פעולה, ומה 3 הפעולות הבטוחות הבאות.`
  });
}

export function supplierQueueAiPrompt({ labels = {} } = {}) {
  const totalSuppliers = asNumber(labels.totalSuppliers);
  const transportSuppliers = asNumber(labels.transportSuppliers);
  const facilitySuppliers = asNumber(labels.facilitySuppliers);
  const goodsSuppliers = asNumber(labels.goodsSuppliers);
  const untypedSuppliers = asNumber(labels.untypedSuppliers);
  const openTickets = asNumber(labels.openTickets);
  const openOrders = asNumber(labels.openOrders);
  const linkedFleet = asNumber(labels.linkedFleet);
  const linkedTechnicians = asNumber(labels.linkedTechnicians);
  const missingContacts = asNumber(labels.missingContacts);
  const topSuppliers = Array.isArray(labels.topSuppliers) ? labels.topSuppliers.map((x) => safeLabel(x)).filter(Boolean).slice(0, 5) : [];
  const hasRisk = openTickets > 0 || openOrders > 0 || missingContacts > 0 || untypedSuppliers > 0;
  const riskLine = hasRisk
    ? [
      openTickets ? `${compactCount(openTickets)} קריאות פתוחות` : "",
      openOrders ? `${compactCount(openOrders)} הזמנות פתוחות` : "",
      missingContacts ? `${compactCount(missingContacts)} ספקים ללא אנשי קשר` : "",
      untypedSuppliers ? `${compactCount(untypedSuppliers)} ספקים ללא סיווג` : ""
    ].filter(Boolean).join("; ")
    : "אין כרגע קריאות או הזמנות פתוחות אצל ספקים.";
  const contextParts = [
    `${compactCount(totalSuppliers)} ספקים וקבלנים`,
    `${compactCount(transportSuppliers)} שינוע, ${compactCount(facilitySuppliers)} אחזקה, ${compactCount(goodsSuppliers)} ציוד/רכש`,
    riskLine,
    linkedFleet ? `${compactCount(linkedFleet)} כלי שינוע מקושרים` : "",
    linkedTechnicians ? `${compactCount(linkedTechnicians)} טכנאים משויכים` : "",
    topSuppliers.length ? `מוקדי עומס: ${topSuppliers.join("; ")}` : ""
  ].filter(Boolean);

  return Object.freeze({
    workflow: hasRisk ? AI_ASSIST_WORKFLOWS.riskSummary : AI_ASSIST_WORKFLOWS.nextActions,
    text: `נתח את ספקים וקבלנים. ${contextParts.join("; ")}. הסבר איפה יש עומס או סיכון תפעולי, מה צריך לבדוק לפני שינוי שיוך/הזמנה/קריאה, ומה 3 הפעולות הבטוחות הבאות.`
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
