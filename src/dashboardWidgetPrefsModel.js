export function dashboardWidgetPrefsKey(session = {}) {
  const id = String(session?.id || session?.email || session?.role || "anonymous").trim() || "anonymous";
  return `dashboardWidgets:${id}`;
}

export function parseDashboardWidgetPrefs(raw) {
  if (!raw) return {};
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function dashboardWidgetsWithPrefs(defaults = {}, configWidgets = {}, prefs = {}) {
  return { ...(defaults || {}), ...(configWidgets || {}), ...(prefs || {}) };
}

export function toggleDashboardWidgetPref(prefs = {}, id = "", currentValue = true) {
  if (!id) return { ...(prefs || {}) };
  return { ...(prefs || {}), [id]: !currentValue };
}
