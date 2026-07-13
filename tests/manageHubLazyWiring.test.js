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

  it("wires the management hub to the shared AI panel entry point", () => {
    expect(appSource).toContain("onAskAI={aiAssistantEnabled(config) ? askAI : null} />) : activeView === \"teamAdmin\"");
    expect(appSource).toContain("<ManageHub {...p} focusTaskId={taskNav} onTaskFocusConsumed={() => setTaskNav(null)} onAskAI={aiAssistantEnabled(config) ? askAI : null} />");
    expect(manageHubSource).toContain("managementTasksAiPrompt");
    expect(manageHubSource).toContain("const askTasksAI = p.onAskAI");
    expect(manageHubSource).toContain("const askMeetingsAI = p.onAskAI");
  });

  it("passes management tasks and meetings into the shared AI context snapshot", () => {
    const aiPanelSource = readFileSync(new URL("../src/AIPanel.jsx", import.meta.url), "utf8");
    expect(appSource).toContain("function buildAIContextSnapshot(session, tickets, pm, fleet, cfg, tasks = [], meetings = [])");
    expect(appSource).toContain("tasks,");
    expect(appSource).toContain("meetings,");
    expect(aiPanelSource).toContain("tasks = [], meetings = []");
    expect(aiPanelSource).toContain("buildContext(session, vis, pm, fleet, config, tasks, meetings)");
  });
});
