const truthy = new Set(["1", "true", "yes", "on", "enabled"]);

const cleanText = (value, limit = 120) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase()
  .slice(0, limit);

export function ticketServerCreateV2Enabled(env = {}) {
  const raw = cleanText(env.CMMS_TICKET_SERVER_CREATE_V2);
  if (!raw || raw === "false" || raw === "0" || raw === "off" || raw === "disabled") return false;
  if (truthy.has(raw)) return true;

  const appMode = cleanText(env.CMMS_APP_MODE || env.VITE_CMMS_APP_MODE || env.NODE_ENV);
  if (raw === "test") return appMode === "test" || env.NODE_ENV === "test";
  if (raw === "local") return ["local", "demo", "development", "test"].includes(appMode) || env.NODE_ENV === "test";
  if (raw === "staging") return appMode === "staging";
  if (raw === "production") return appMode === "production";

  return false;
}

export function ticketServerCreateV2DependencyReady(env = {}) {
  const raw = cleanText(env.CMMS_TICKET_SERVER_CREATE_V2_READY);
  if (!raw || raw === "false" || raw === "0" || raw === "off" || raw === "disabled") return false;
  if (truthy.has(raw)) return true;

  const appMode = cleanText(env.CMMS_APP_MODE || env.VITE_CMMS_APP_MODE || env.NODE_ENV);
  if (raw === "test") return appMode === "test" || env.NODE_ENV === "test";
  if (raw === "local") return ["local", "demo", "development", "test"].includes(appMode) || env.NODE_ENV === "test";
  if (raw === "staging") return appMode === "staging";
  if (raw === "production") return appMode === "production";

  return false;
}

export function ticketServerCreateV2Status({ env = {}, driver = null } = {}) {
  const configured = ticketServerCreateV2Enabled(env);
  const dependencyConfigured = configured && ticketServerCreateV2DependencyReady(env) && typeof driver?.create === "function";
  const ready = configured && dependencyConfigured;
  return {
    configured,
    dependency: configured ? (dependencyConfigured ? "configured" : "unavailable") : "disabled",
    ready,
    disabledReason: ready ? "" : configured ? "ticket_create_rpc_unavailable" : "ticket_server_create_v2_disabled"
  };
}
