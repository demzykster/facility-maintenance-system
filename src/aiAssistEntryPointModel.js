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
