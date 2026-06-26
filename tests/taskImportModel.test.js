import { describe, expect, it } from "vitest";
import { findTaskImportMatch, taskImportStatusGroup, taskImportTitleKey } from "../src/taskImportModel.js";

describe("task import duplicate matching", () => {
  it("normalizes title keys", () => {
    expect(taskImportTitleKey("  Fix   Pump  ")).toBe("fix pump");
  });

  it("groups active task statuses as open and final statuses as closed", () => {
    expect(taskImportStatusGroup("todo")).toBe("open");
    expect(taskImportStatusGroup("waiting")).toBe("open");
    expect(taskImportStatusGroup("done")).toBe("closed");
    expect(taskImportStatusGroup("cancelled")).toBe("closed");
  });

  it("matches same title, meeting, and open status group", () => {
    const match = findTaskImportMatch([
      { id: "t1", title: "בדיקת דלת", status: "waiting", meetingId: "m1" },
    ], { title: " בדיקת  דלת ", status: "todo", meetingId: "m1" });

    expect(match?.id).toBe("t1");
  });

  it("does not match a closed existing task when the imported row is open", () => {
    const match = findTaskImportMatch([
      { id: "closed", title: "בדיקת דלת", status: "done", meetingId: "m1" },
    ], { title: "בדיקת דלת", status: "todo", meetingId: "m1" });

    expect(match).toBeNull();
  });

  it("does not match an open existing task when the imported row is closed", () => {
    const match = findTaskImportMatch([
      { id: "open", title: "בדיקת דלת", status: "in_progress", meetingId: "m1" },
    ], { title: "בדיקת דלת", status: "done", meetingId: "m1" });

    expect(match).toBeNull();
  });

  it("matches linked meeting ids", () => {
    const match = findTaskImportMatch([
      { id: "linked", title: "בדיקת דלת", status: "todo", linkedMeetingIds: ["m2"] },
    ], { title: "בדיקת דלת", status: "waiting", meetingId: "m2" });

    expect(match?.id).toBe("linked");
  });

  it("does not match empty imported titles", () => {
    const match = findTaskImportMatch([
      { id: "empty", title: "", status: "todo" },
    ], { title: "", status: "todo" });

    expect(match).toBeNull();
  });
});
