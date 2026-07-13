import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");
const manageHubSource = readFileSync(new URL("../src/ManageHub.jsx", import.meta.url), "utf8");

describe("management tasks and meetings lazy wiring", () => {
  it("keeps the management hub behind a lazy wrapper", () => {
    expect(appSource).toContain('const ManageHubLazy = lazy(() => import("./ManageHub.jsx")');
    expect(appSource).toContain("<ManageHubLazy");
    expect(appSource).toContain("manageHubUi");
    expect(appSource).not.toContain("function TasksModule(");
    expect(appSource).not.toContain("function MeetingsModule(");
  });

  it("keeps task and meeting workflows in the lazy module", () => {
    expect(manageHubSource).toContain("export function ManageHub(");
    expect(manageHubSource).toContain("function TasksModule(");
    expect(manageHubSource).toContain("function MeetingsModule(");
    expect(manageHubSource).toContain("function TaskImportWizard(");
  });
});
