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
    const agentSessionSource = readFileSync(new URL("../src/useAIAgentSession.js", import.meta.url), "utf8");
    expect(appSource).toContain("function buildAIContextSnapshot(session, tickets, pm, fleet, cfg, tasks = [], meetings = [], users = [], ppeItems = [], ppeReqs = [], zones = [])");
    expect(appSource).toContain("users,");
    expect(appSource).toContain("tasks,");
    expect(appSource).toContain("meetings,");
    expect(aiPanelSource).toContain("users = [], tasks = [], meetings = [], ppeItems = [], ppeReqs = [], zones = []");
    expect(aiPanelSource).toContain("useAIAgentSession");
    expect(agentSessionSource).toContain("buildContext(session, scopedTickets, pm, fleet, config, tasks, meetings, users, ppeItems, ppeReqs, zones)");
  });

  it("wires confirmed AI task and meeting creation through the normal save paths", () => {
    const actionAdapterSource = readFileSync(new URL("../src/aiAgentActionAdapter.js", import.meta.url), "utf8");
    expect(appSource).toContain("createAiAgentActionExecutor");
    expect(appSource).not.toContain("prepareAiMeetingCreateForSave");
    expect(actionAdapterSource).toContain("prepareAiMeetingCreateForSave");
    expect(actionAdapterSource).toContain("prepareAiMeetingUpdateForSave");
    expect(actionAdapterSource).toContain("prepareAiCleaningComplaintCreateForSave");
    expect(actionAdapterSource).toContain("prepareAiPpeRequestCreateForSave");
    expect(actionAdapterSource).toContain("prepareAiTaskCreateForSave");
    expect(actionAdapterSource).toContain("prepareAiTaskUpdateForSave");
    expect(actionAdapterSource).toContain('if (action?.type === "meeting.create")');
    expect(actionAdapterSource).toContain('if (action?.type === "meeting.update")');
    expect(actionAdapterSource).toContain('if (action?.type === "task.create")');
    expect(actionAdapterSource).toContain('if (action?.type === "task.update")');
    expect(actionAdapterSource).toContain('if (action?.type === "ppe.request.create")');
    expect(actionAdapterSource).toContain('if (action?.type === "cleaning.complaint.create")');
    expect(actionAdapterSource).toContain('typeof props.saveMeeting !== "function"');
    expect(actionAdapterSource).toContain('typeof props.saveTask !== "function"');
    expect(actionAdapterSource).toContain('typeof props.savePpeReq !== "function"');
    expect(actionAdapterSource).toContain('typeof props.fileComplaint !== "function"');
    expect(actionAdapterSource).toContain("const meeting = prepareAiMeetingCreateForSave(action, props.session");
    expect(actionAdapterSource).toContain("prepareAiMeetingUpdateForSave(action, existing, props.session");
    expect(actionAdapterSource).toContain("const task = prepareAiTaskCreateForSave(action, props.session");
    expect(actionAdapterSource).toContain("prepareAiTaskUpdateForSave(action, existing, props.session");
    expect(actionAdapterSource).toContain("const request = prepareAiPpeRequestCreateForSave(action, props.session");
    expect(actionAdapterSource).toContain("const complaint = prepareAiCleaningComplaintCreateForSave(action, props.session");
    expect(actionAdapterSource).toContain("await props.saveMeeting(meeting)");
    expect(actionAdapterSource).toContain("await props.saveTask(task)");
    expect(actionAdapterSource).toContain("await props.savePpeReq(request)");
    expect(actionAdapterSource).toContain("await props.fileComplaint(complaint)");
    expect(appSource).toContain("executeAction={executeAction}");
  });
});
