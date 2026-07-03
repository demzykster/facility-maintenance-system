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
