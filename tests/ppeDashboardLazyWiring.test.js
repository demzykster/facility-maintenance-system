import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../src/PpeDashboard.jsx", import.meta.url), "utf8");

describe("PPE dashboard lazy wiring", () => {
  it("keeps the PPE stock dashboard out of the startup module", () => {
    expect(appSource).toContain('const PpeDashboardLazy = lazy(() => import("./PpeDashboard.jsx")');
    expect(appSource).toContain("<PpeDashboardLazy");
    expect(appSource).not.toContain("ppeDashboardAiPrompt");
  });

  it("keeps the PPE dashboard AI prompt with the lazy dashboard chunk", () => {
    expect(dashboardSource).toContain('import { ppeDashboardAiPrompt } from "./aiAssistEntryPointModel.js"');
    expect(dashboardSource).toContain("export function PpeDashboard(");
    expect(dashboardSource).toContain("שאל AI");
  });
});
