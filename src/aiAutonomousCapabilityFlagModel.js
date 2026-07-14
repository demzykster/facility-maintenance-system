const truthy = new Set(["1", "true", "yes", "on", "enabled"]);

const cleanText = (value, limit = 120) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase()
  .slice(0, limit);

export function autonomousTicketCreateEnabled(env = {}) {
  const raw = cleanText(env.CMMS_AI_AUTONOMOUS_TICKET_CREATE);
  if (!raw || raw === "false" || raw === "0" || raw === "off" || raw === "disabled") return false;
  if (truthy.has(raw)) return true;

  const appMode = cleanText(env.CMMS_APP_MODE || env.VITE_CMMS_APP_MODE || env.NODE_ENV);
  if (raw === "test") return appMode === "test" || env.NODE_ENV === "test";
  if (raw === "local") return ["local", "demo", "development", "test"].includes(appMode) || env.NODE_ENV === "test";
  if (raw === "staging") return appMode === "staging";
  if (raw === "production") return appMode === "production";

  return false;
}
