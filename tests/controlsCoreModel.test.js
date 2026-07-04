import { describe, expect, it } from "vitest";
import {
  CONTROL_MANUAL_RUN_PRESETS,
  controlAssignmentDraftFromProgram,
  controlSignalEnvelope,
  controlFindingTaskDraft,
  controlManualRunPresetById,
  controlManualRunPresetsForDomain,
  controlProgramDraftFromManualPreset,
  controlRunDraftFromAssignment,
  normalizeActionRoute,
  normalizeControlAssignment,
  normalizeControlFinding,
  normalizeControlProgram,
  normalizeControlRun,
  normalizeFindingVisibility
} from "../src/controlsCoreModel.js";

describe("controls core model", () => {
  it("keeps manual domain presets explicit and domain-scoped", () => {
    expect(CONTROL_MANUAL_RUN_PRESETS.map((preset) => preset.id)).toEqual([
      "safety-walk-basic",
      "fleet-yard-check",
      "quality-returns-sample",
      "cleaning-zone-quality-check",
      "operations-executive-walk"
    ]);

    expect(controlManualRunPresetsForDomain("safety")).toHaveLength(1);
    expect(controlManualRunPresetsForDomain("safety")[0]).toMatchObject({
      id: "safety-walk-basic",
      domain: "safety",
      name: "סיור בטיחות ידני",
      routeType: "report_only"
    });
    expect(controlManualRunPresetsForDomain("fleet")[0]).toMatchObject({
      id: "fleet-yard-check",
      domain: "fleet",
      routeType: "task"
    });
    expect(controlManualRunPresetsForDomain("cleaning")[0]).toMatchObject({
      id: "cleaning-zone-quality-check",
      domain: "cleaning",
      routeType: "report_only"
    });
    expect(controlManualRunPresetById("missing")).toBeNull();
  });

  it("normalizes a control program with group coordination and schedule guardrails", () => {
    const program = normalizeControlProgram({
      id: "prog-safety-zone-a",
      name: "Warehouse A safety walk",
      domain: "safety",
      targetType: "location",
      targetIds: ["loc-a", "loc-a", ""],
      checklist: ["Emergency exits", { id: "ppe", label: "PPE", photoRequired: true }],
      responsibleIds: ["manager-1"],
      notifyIds: ["safety-lead", "safety-lead"],
      groupIds: ["safety-committee"],
      schedulePolicy: {
        preferredWeekdays: ["0", "4", "4"],
        antiDuplicateWindowDays: 30,
        coverageThreshold: { every: 1, unit: "month" },
        maxDelayDays: 7
      }
    });

    expect(program).toMatchObject({
      id: "prog-safety-zone-a",
      name: "Warehouse A safety walk",
      domain: "safety",
      active: true,
      targetType: "location",
      targetIds: ["loc-a"],
      responsibleIds: ["manager-1"],
      notifyIds: ["safety-lead"],
      groupIds: ["safety-committee"],
      schedulePolicy: {
        preferredWeekdays: ["0", "4"],
        skipWeekends: true,
        antiDuplicateWindowDays: 30,
        coverageThreshold: { every: 1, unit: "month" },
        maxDelayDays: 7
      }
    });
    expect(program.checklistItems).toEqual([
      { id: "item-1", label: "Emergency exits", photoPolicy: "optional_on_problem" },
      { id: "ppe", label: "PPE", photoRequired: true, photoPolicy: "required_on_problem" }
    ]);
  });

  it("builds a saved program and manual assignment draft from a domain preset without scheduling", () => {
    const program = controlProgramDraftFromManualPreset("safety-walk-basic", {
      id: "prog-safety-main-warehouse",
      name: "Weekly safety walk - main warehouse",
      targetIds: ["loc-main"],
      responsibleIds: ["manager-1"],
      participantIds: ["safety-1"],
      notifyIds: ["safety-lead"],
      groupIds: ["safety-committee"]
    });

    expect(program).toMatchObject({
      id: "prog-safety-main-warehouse",
      name: "Weekly safety walk - main warehouse",
      domain: "safety",
      sourcePresetId: "safety-walk-basic",
      targetType: "location",
      targetIds: ["loc-main"],
      responsibleIds: ["manager-1"],
      participantIds: ["safety-1"],
      notifyIds: ["safety-lead"],
      groupIds: ["safety-committee"],
      actionPolicy: { defaultRouteType: "report_only" }
    });
    expect(program.checklistItems.map((item) => item.label)).toEqual([
      "יציאות חירום פתוחות",
      "מעברים פנויים",
      "ציוד מגן בשימוש",
      "אין מפגעי החלקה/מעידה"
    ]);

    const assignment = controlAssignmentDraftFromProgram(program, {
      id: "asg-safety-main-warehouse-1",
      target: { kind: "location", locationId: "loc-main", label: "Main warehouse" },
      dueAt: "2026-07-12",
      createdAt: "2026-07-04T08:00:00Z"
    });

    expect(assignment).toMatchObject({
      id: "asg-safety-main-warehouse-1",
      programId: "prog-safety-main-warehouse",
      sourceProgramId: "prog-safety-main-warehouse",
      assignedToIds: ["manager-1"],
      participantIds: ["safety-1"],
      groupIds: ["safety-committee"],
      target: { kind: "location", id: "loc-main", locationId: "loc-main", label: "Main warehouse" },
      scheduledAt: "2026-07-12",
      dueAt: "2026-07-12",
      status: "planned",
      generatedBy: "manual",
      createdAt: "2026-07-04T08:00:00Z"
    });
    expect(program).not.toHaveProperty("assignments");
    expect(controlProgramDraftFromManualPreset("missing")).toBeNull();
    expect(controlAssignmentDraftFromProgram({})).toBeNull();
  });

  it("preserves fleet targets through program assignments and run drafts", () => {
    const program = controlProgramDraftFromManualPreset("fleet-yard-check", {
      id: "prog-fleet-yard",
      targetType: "fleet",
      targetIds: ["fleet-123"],
      responsibleIds: ["manager-1"],
      notifyIds: ["fleet-manager"]
    });

    expect(program).toMatchObject({
      id: "prog-fleet-yard",
      domain: "fleet",
      targetType: "fleet",
      targetIds: ["fleet-123"],
      actionPolicy: { defaultRouteType: "task" }
    });

    const assignment = controlAssignmentDraftFromProgram(program, {
      id: "asg-fleet-123",
      target: {
        kind: "fleet",
        fleetId: "fleet-123",
        label: "123 · מלגזה · OSE250",
        sourceModule: "fleet"
      },
      dueAt: "2026-07-12"
    });

    expect(assignment).toMatchObject({
      id: "asg-fleet-123",
      target: {
        kind: "fleet",
        id: "fleet-123",
        fleetId: "fleet-123",
        label: "123 · מלגזה · OSE250",
        sourceModule: "fleet"
      }
    });

    const run = controlRunDraftFromAssignment(assignment, {
      id: "run-fleet-123",
      performedById: "manager-1"
    });

    expect(run).toMatchObject({
      id: "run-fleet-123",
      programId: "prog-fleet-yard",
      target: {
        kind: "fleet",
        id: "fleet-123",
        fleetId: "fleet-123",
        label: "123 · מלגזה · OSE250",
        sourceModule: "fleet"
      }
    });
  });

  it("preserves cleaning zone targets without migrating them to locations", () => {
    const program = controlProgramDraftFromManualPreset("cleaning-zone-quality-check", {
      id: "prog-cleaning-quality",
      targetType: "cleaning_zone",
      targetIds: ["zone-a"],
      responsibleIds: ["manager-1"]
    });

    expect(program).toMatchObject({
      id: "prog-cleaning-quality",
      domain: "cleaning",
      targetType: "cleaning_zone",
      targetIds: ["zone-a"],
      actionPolicy: { defaultRouteType: "report_only" }
    });

    const assignment = controlAssignmentDraftFromProgram(program, {
      id: "asg-cleaning-zone-a",
      target: {
        kind: "cleaning_zone",
        id: "zone-a",
        label: "שירותים קומה 1",
        sourceModule: "cleaning"
      },
      dueAt: "2026-07-12"
    });

    expect(assignment).toMatchObject({
      id: "asg-cleaning-zone-a",
      target: {
        kind: "cleaning_zone",
        id: "zone-a",
        label: "שירותים קומה 1",
        sourceModule: "cleaning"
      }
    });
    expect(assignment.target).not.toHaveProperty("locationId");

    const run = controlRunDraftFromAssignment(assignment, {
      id: "run-cleaning-zone-a",
      performedById: "manager-1"
    });

    expect(run).toMatchObject({
      id: "run-cleaning-zone-a",
      programId: "prog-cleaning-quality",
      target: {
        kind: "cleaning_zone",
        id: "zone-a",
        label: "שירותים קומה 1",
        sourceModule: "cleaning"
      }
    });
  });

  it("keeps assignment due date, target, assignees, and reschedule history explicit", () => {
    const assignment = normalizeControlAssignment({
      id: "asg-1",
      programId: "prog-1",
      assignedToIds: ["manager-1", "manager-1"],
      participantIds: ["safety-1"],
      target: { kind: "location", locationId: "loc-a", label: "Warehouse A" },
      scheduledAt: "2026-07-05",
      dueAt: "2026-07-09",
      status: "rescheduled",
      runId: "run-1",
      rescheduleHistory: [{ from: "2026-07-03", to: "2026-07-05", reason: "absence" }],
      generatedBy: "schedule",
      completedAt: "2026-07-09T09:30:00Z"
    });

    expect(assignment).toMatchObject({
      id: "asg-1",
      programId: "prog-1",
      assignedToIds: ["manager-1"],
      participantIds: ["safety-1"],
      target: { kind: "location", id: "loc-a", locationId: "loc-a", label: "Warehouse A" },
      scheduledAt: "2026-07-05",
      dueAt: "2026-07-09",
      status: "rescheduled",
      runId: "run-1",
      generatedBy: "schedule",
      completedAt: "2026-07-09T09:30:00Z"
    });
    expect(assignment.rescheduleHistory).toHaveLength(1);
  });

  it("normalizes run records with one overall signature, not per-item signatures", () => {
    const run = normalizeControlRun({
      id: "run-1",
      programId: "prog-1",
      assignmentId: "asg-1",
      performedById: "manager-1",
      participantIds: ["qa-1", "qa-1"],
      locationId: "loc-a",
      answers: [{ itemId: "ppe", value: "not_ok" }],
      signature: { signedById: "manager-1", signedAt: "2026-07-04T09:00:00Z" },
      status: "completed"
    });

    expect(run).toMatchObject({
      id: "run-1",
      programId: "prog-1",
      assignmentId: "asg-1",
      performedById: "manager-1",
      participantIds: ["qa-1"],
      target: { kind: "general", id: "loc-a" },
      answers: [{ itemId: "ppe", value: "not_ok" }],
      overallSignature: { signedById: "manager-1", signedAt: "2026-07-04T09:00:00Z" },
      status: "completed"
    });
  });

  it("builds a run draft from one assignment without completing it automatically", () => {
    const run = controlRunDraftFromAssignment({
      id: "asg-safety-main-warehouse-1",
      programId: "prog-safety-main-warehouse",
      assignedToIds: ["manager-1"],
      participantIds: ["safety-1", "safety-1"],
      target: { kind: "location", locationId: "loc-main", label: "Main warehouse" },
      dueAt: "2026-07-12",
      status: "planned"
    }, {
      id: "run-safety-main-warehouse-1",
      performedById: "manager-1",
      startedAt: "2026-07-12T07:30:00Z",
      status: "in_progress"
    });

    expect(run).toEqual({
      id: "run-safety-main-warehouse-1",
      programId: "prog-safety-main-warehouse",
      assignmentId: "asg-safety-main-warehouse-1",
      performedById: "manager-1",
      participantIds: ["safety-1"],
      target: { kind: "location", id: "loc-main", locationId: "loc-main", label: "Main warehouse" },
      startedAt: "2026-07-12T07:30:00Z",
      finishedAt: null,
      answers: [],
      findingIds: [],
      overallSignature: {},
      status: "in_progress"
    });
    expect(controlRunDraftFromAssignment({ id: "missing-program" })).toBeNull();
  });

  it("uses a visibility policy object for sensitive findings instead of a boolean-only model", () => {
    const visibility = normalizeFindingVisibility({
      scope: "restricted",
      userIds: ["qa-lead"],
      groupIds: ["quality-team"],
      departmentIds: ["returns"],
      redactWorkerIdentity: true,
      sensitive: true
    });

    expect(visibility).toEqual({
      scope: "restricted",
      userIds: ["qa-lead"],
      groupIds: ["quality-team"],
      departmentIds: ["returns"],
      roleIds: [],
      redactWorkerIdentity: true
    });
  });

  it("normalizes finding action routes for report-only, task, ticket, and notification decisions", () => {
    expect(normalizeActionRoute({ type: "report_only", note: "For monthly report" })).toMatchObject({
      type: "report_only",
      status: "pending",
      note: "For monthly report"
    });
    expect(normalizeActionRoute({ type: "task", taskId: "mtask-1", notifyIds: ["u1", "u1"] })).toMatchObject({
      type: "task",
      taskId: "mtask-1",
      notifyIds: ["u1"]
    });
    expect(normalizeActionRoute({ type: "ticket", ticketId: "ticket-1" })).toMatchObject({ type: "ticket", ticketId: "ticket-1" });
    expect(normalizeActionRoute({ type: "notify", groupIds: ["safety-committee"] })).toMatchObject({ type: "notify", groupIds: ["safety-committee"] });
  });

  it("keeps quality findings narrow by default and projects a dashboard signal envelope", () => {
    const finding = normalizeControlFinding({
      id: "finding-1",
      programId: "quality-program-1",
      runId: "run-1",
      domain: "quality",
      title: "Wrong item in return handling",
      severity: "high",
      status: "triage",
      subject: { process: "returns", workerKnown: false },
      visibility: { scope: "restricted", groupIds: ["quality-team"] },
      route: { type: "task", taskId: "mtask-1" },
      createdById: "qa-1",
      createdAt: "2026-07-04T10:00:00Z"
    });

    expect(finding).toMatchObject({
      id: "finding-1",
      domain: "quality",
      title: "Wrong item in return handling",
      severity: "high",
      status: "triage",
      visibility: { scope: "restricted", groupIds: ["quality-team"] },
      route: { type: "task", taskId: "mtask-1" }
    });
    expect(finding).not.toHaveProperty("score");
    expect(finding).not.toHaveProperty("capa");
    expect(controlSignalEnvelope({
      id: finding.id,
      severity: finding.severity,
      status: finding.status,
      responsibleIds: ["qa-lead"],
      dueAt: "2026-07-10"
    })).toEqual({
      severity: "high",
      status: "triage",
      assignedTo: ["qa-lead"],
      dueAt: "2026-07-10",
      sourceModule: "controls",
      sourceId: "finding-1"
    });
  });

  it("builds a task draft from a finding only when the route is a task", () => {
    const draft = controlFindingTaskDraft({
      id: "finding-task-1",
      programId: "program-1",
      runId: "run-1",
      domain: "safety",
      title: "Blocked emergency exit",
      description: "Pallet blocks the emergency exit.",
      severity: "critical",
      target: { kind: "location", id: "loc-a", label: "Warehouse A" },
      route: { type: "task", notifyIds: ["manager-1", "manager-1"] }
    }, { dueAt: 1783209600000 });

    expect(draft).toMatchObject({
      title: "Blocked emergency exit",
      desc: "Pallet blocks the emergency exit.\nהקשר: Warehouse A",
      responsibleIds: ["manager-1"],
      priority: "high",
      status: "todo",
      mode: "deadline",
      dueAt: 1783209600000,
      category: "בטיחות",
      locationText: "Warehouse A",
      sourceModule: "controls",
      sourceId: "finding-task-1",
      sourceFindingId: "finding-task-1",
      sourceProgramId: "program-1",
      sourceRunId: "run-1",
      sourceLabel: "Blocked emergency exit"
    });

    expect(controlFindingTaskDraft({ id: "finding-report-1", route: { type: "report_only" } })).toBeNull();
  });
});
