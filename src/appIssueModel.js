export const APP_ISSUE_STATUS = Object.freeze({
  open: "open",
  reviewing: "reviewing",
  resolved: "resolved",
});

export function appIssueStatusLabel(status) {
  if (status === APP_ISSUE_STATUS.resolved) return "טופל";
  if (status === APP_ISSUE_STATUS.reviewing) return "בבדיקה";
  return "פתוח";
}

export function createAppIssue({
  id,
  at = Date.now(),
  description = "",
  screenshot = "",
  screenshotContext = {},
  session = {},
  location = "",
  userAgent = "",
} = {}) {
  const text = String(description || "").trim();
  if (!text) throw new Error("description_required");
  if (text.length > 1200) throw new Error("description_too_long");
  return {
    id: id || `ai-${at.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    updatedAt: at,
    status: APP_ISSUE_STATUS.open,
    description: text,
    screenshot: typeof screenshot === "string" ? screenshot : "",
    screenshotContext: screenshotContext && typeof screenshotContext === "object" && !Array.isArray(screenshotContext) ? {
      location: String(screenshotContext.location || ""),
      viewport: String(screenshotContext.viewport || ""),
      devicePixelRatio: Number(screenshotContext.devicePixelRatio || 0),
      screenshotSize: String(screenshotContext.screenshotSize || ""),
    } : {},
    location: String(location || ""),
    userAgent: String(userAgent || ""),
    reporter: {
      id: session.id || "",
      name: session.name || "",
      role: session.role || "",
      dept: session.dept || "",
      email: session.email || "",
    },
    response: "",
    responseBy: "",
    responseAt: null,
  };
}

const cleanObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function normalizeAppIssueRecord(issue = {}) {
  const id = String(issue.id || "").trim();
  if (!id) throw new Error("app_issue_id_required");
  const at = Number(issue.at || Date.now());
  return {
    ...issue,
    id,
    at,
    updatedAt: Number(issue.updatedAt || at),
    status: Object.values(APP_ISSUE_STATUS).includes(issue.status) ? issue.status : APP_ISSUE_STATUS.open,
    description: String(issue.description || "").trim(),
    screenshot: typeof issue.screenshot === "string" ? issue.screenshot : "",
    screenshotContext: cleanObject(issue.screenshotContext),
    location: String(issue.location || ""),
    userAgent: String(issue.userAgent || ""),
    reporter: cleanObject(issue.reporter),
    response: String(issue.response || ""),
    responseBy: String(issue.responseBy || ""),
    responseAt: issue.responseAt || null,
    sourceKvKey: String(issue.sourceKvKey || `appIssue:${id}`).trim(),
    legacyPayload: issue.legacyPayload && typeof issue.legacyPayload === "object" ? issue.legacyPayload : { ...issue }
  };
}

export function appIssueRecordToSupabaseRow(issue = {}) {
  const record = normalizeAppIssueRecord(issue);
  return {
    id: record.id,
    status: record.status,
    description: record.description,
    reporter_id: String(record.reporter?.id || ""),
    reporter_name: String(record.reporter?.name || ""),
    reporter_role: String(record.reporter?.role || ""),
    location: record.location,
    screenshot_context: record.screenshotContext,
    reported_at: new Date(record.at).toISOString(),
    updated_at: new Date(record.updatedAt).toISOString(),
    source_kv_key: record.sourceKvKey,
    legacy_payload: record.legacyPayload
  };
}

export function appIssueRecordFromSupabaseRow(row = {}) {
  const legacy = cleanObject(row.legacy_payload);
  if (legacy.id) return legacy;
  return normalizeAppIssueRecord({
    ...legacy,
    id: row.id || legacy.id,
    status: row.status || legacy.status,
    description: row.description || legacy.description,
    location: row.location || legacy.location,
    screenshotContext: cleanObject(row.screenshot_context || legacy.screenshotContext),
    reporter: {
      ...cleanObject(legacy.reporter),
      id: row.reporter_id || legacy.reporter?.id || "",
      name: row.reporter_name || legacy.reporter?.name || "",
      role: row.reporter_role || legacy.reporter?.role || ""
    },
    at: row.reported_at ? Date.parse(row.reported_at) : legacy.at,
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : legacy.updatedAt,
    sourceKvKey: row.source_kv_key || legacy.sourceKvKey,
    legacyPayload: legacy
  });
}

export function updateAppIssueResponse(issue = {}, { response = "", status, actor = {}, at = Date.now() } = {}) {
  const cleanResponse = String(response || "").trim();
  const nextStatus = status || (cleanResponse ? APP_ISSUE_STATUS.reviewing : (issue.status || APP_ISSUE_STATUS.open));
  return {
    ...issue,
    status: Object.values(APP_ISSUE_STATUS).includes(nextStatus) ? nextStatus : APP_ISSUE_STATUS.open,
    response: cleanResponse,
    responseBy: actor.name || issue.responseBy || "",
    responseAt: cleanResponse ? at : null,
    updatedAt: at,
  };
}
