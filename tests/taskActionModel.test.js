import { describe, expect, it } from "vitest";
import { normalizeTaskActionRecord, taskActionSignal, taskActionSourceFields } from "../src/taskActionModel.js";

describe("task action model", () => {
  it("keeps explicit source links for external findings and programs", () => {
    const patch = taskActionSourceFields({
      sourceModule: "fleet",
      sourceFindingId: "finding-1",
      sourceProgramId: "program-1",
      sourceLabel: "בטיחות מחסן"
    });

    expect(patch).toEqual({
      sourceModule: "fleet",
      sourceFindingId: "finding-1",
      sourceProgramId: "program-1",
      sourceLabel: "בטיחות מחסן"
    });
  });

  it("normalizes sourceRef into dashboard-readable source fields", () => {
    const task = normalizeTaskActionRecord({
      id: "mt-1",
      title: "Fix",
      responsibleIds: ["u1", "u1", ""],
      participantIds: ["u2", null, "u2"],
      linkedMeetingIds: ["m1", "m1"],
      sourceRef: {
        module: "fleet",
        findingId: "finding-1",
        programId: "program-1",
        label: "Safety walk"
      }
    });

    expect(task).toMatchObject({
      sourceModule: "fleet",
      sourceId: "finding-1",
      responsibleIds: ["u1"],
      participantIds: ["u2"],
      linkedMeetingIds: ["m1"],
      sourceRef: {
        module: "fleet",
        findingId: "finding-1",
        programId: "program-1",
        label: "Safety walk"
      }
    });
  });

  it("preserves source links when a task is edited through a form-shaped save", () => {
    const original = {
      id: "mt-2",
      title: "Old title",
      sourceModule: "fleet",
      sourceFindingId: "finding-2",
      sourceProgramId: "program-2"
    };
    const formSave = {
      ...taskActionSourceFields(original),
      id: original.id,
      title: "New title",
      responsibleIds: ["u1"],
      participantIds: [],
      linkedMeetingIds: []
    };

    expect(normalizeTaskActionRecord(formSave)).toMatchObject({
      id: "mt-2",
      title: "New title",
      sourceModule: "fleet",
      sourceId: "finding-2",
      sourceFindingId: "finding-2",
      sourceProgramId: "program-2"
    });
  });

  it("projects the minimal common signal envelope without changing storage", () => {
    expect(taskActionSignal({
      priority: "high",
      status: "waiting",
      responsibleIds: ["u1", "u2"],
      dueAt: 123,
      sourceModule: "fleet",
      sourceId: "finding-3"
    })).toEqual({
      severity: "high",
      status: "waiting",
      assignedTo: ["u1", "u2"],
      dueAt: 123,
      sourceModule: "fleet",
      sourceId: "finding-3"
    });
  });
});
