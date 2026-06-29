import { describe, expect, it } from "vitest";
import {
  dashboardWidgetPrefsKey,
  dashboardWidgetsWithPrefs,
  parseDashboardWidgetPrefs,
  toggleDashboardWidgetPref
} from "../src/dashboardWidgetPrefsModel.js";

describe("dashboardWidgetPrefsModel", () => {
  it("uses a user-scoped local preference key", () => {
    expect(dashboardWidgetPrefsKey({ id: "admin-1" })).toBe("dashboardWidgets:admin-1");
    expect(dashboardWidgetPrefsKey({ email: "owner@example.com" })).toBe("dashboardWidgets:owner@example.com");
  });

  it("parses only object-shaped widget preferences", () => {
    expect(parseDashboardWidgetPrefs("{bad")).toEqual({});
    expect(parseDashboardWidgetPrefs(JSON.stringify(["kpis"]))).toEqual({});
    expect(parseDashboardWidgetPrefs(JSON.stringify({ kpis: false }))).toEqual({ kpis: false });
  });

  it("keeps global config as the default and lets local prefs override it", () => {
    expect(dashboardWidgetsWithPrefs(
      { kpis: true, docs: true },
      { docs: false },
      { kpis: false }
    )).toEqual({ kpis: false, docs: false });
  });

  it("toggles only the selected local widget preference", () => {
    expect(toggleDashboardWidgetPref({ docs: false }, "kpis", true)).toEqual({ docs: false, kpis: false });
    expect(toggleDashboardWidgetPref({ kpis: false }, "kpis", false)).toEqual({ kpis: true });
  });
});
