import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const biOverviewSource = readFileSync(new URL("../src/BIOverview.jsx", import.meta.url), "utf8");

describe("BI overview lazy wiring", () => {
  it("keeps the BI overview behind a lazy wrapper", () => {
    expect(appSource).toContain('const BIOverviewLazy = lazy(() => import("./BIOverview.jsx")');
    expect(appSource).toContain("<BIOverviewLazy");
    expect(appSource).toContain("biOverviewUi");
    expect(appSource).toMatch(/biOverviewUi\(\) \{[\s\S]*countLabel/);
    expect(appSource).toMatch(/biOverviewUi\(\) \{[\s\S]*dayCompliance/);
    expect(appSource).toMatch(/biOverviewUi\(\) \{[\s\S]*lifecycleOwnerLabel/);
    expect(appSource).not.toContain("function BIOverview({ session");
  });

  it("keeps BI heatmap, drilldowns, and AI entry points in the lazy module", () => {
    expect(biOverviewSource).toContain("export function BIOverview(");
    expect(biOverviewSource).toContain("<BIHeatmapPanel");
    expect(biOverviewSource).toContain("biHeatmapAiPrompt");
    expect(biOverviewSource).toContain("ticketHeatmapRows");
    expect(biOverviewSource).toContain("onGoTickets");
  });
});
