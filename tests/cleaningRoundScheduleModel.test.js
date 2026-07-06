import { describe, expect, it } from "vitest";
import {
  buildCleaningMissedRoundRecord,
  cleaningMissedRoundExists,
  cleaningMissedRoundRecordsForStatuses,
  isCleaningRoundActionableStatus,
  isCompletedCleaningRound,
  isMissedCleaningRound
} from "../src/cleaningRoundScheduleModel.js";

describe("cleaning round schedule model", () => {
  it("treats only current windows as actionable work", () => {
    expect(isCleaningRoundActionableStatus("due")).toBe(true);
    expect(isCleaningRoundActionableStatus("overdue")).toBe(true);
    expect(isCleaningRoundActionableStatus("missed")).toBe(false);
    expect(isCleaningRoundActionableStatus("upcoming")).toBe(false);
    expect(isCleaningRoundActionableStatus("done")).toBe(false);
  });

  it("distinguishes missed history records from completed rounds", () => {
    expect(isMissedCleaningRound({ type: "missed" })).toBe(true);
    expect(isCompletedCleaningRound({ type: "missed" })).toBe(false);
    expect(isCompletedCleaningRound({ doneCount: 2 })).toBe(true);
  });

  it("builds one persisted missed record per zone window and day", () => {
    const zone = { id: "zone-1", name: "מטבחון", cleanerId: "u1", cleanerName: "Cleaner", checklist: [{ id: "soap" }] };
    const winStatus = {
      win: { id: "w0600", time: "06:00" },
      status: "missed",
      target: 1000,
      slotStart: 900,
      slotEnd: 2000,
      zoneLoc: "משרדים · קומה 1",
      totalItems: 1
    };

    const record = buildCleaningMissedRoundRecord({ zone, winStatus, dayStart: 0 });

    expect(record).toMatchObject({
      type: "missed",
      status: "missed",
      zoneId: "zone-1",
      zoneName: "מטבחון",
      zoneLoc: "משרדים · קומה 1",
      winId: "w0600",
      winTime: "06:00",
      at: 2000,
      scheduledAt: 1000,
      byUid: "u1",
      byName: "Cleaner",
      doneCount: 0,
      total: 1,
      system: true
    });
    expect(record.id).toBe("missed_zone-1_w0600_0");
  });

  it("does not duplicate missed records that already exist", () => {
    const zone = { id: "zone-1", name: "מטבחון", checklist: [] };
    const statuses = [{ win: { id: "w0600", time: "06:00" }, status: "missed", target: 1000, slotStart: 900, slotEnd: 2000 }];
    const existing = buildCleaningMissedRoundRecord({ zone, winStatus: statuses[0], dayStart: 0 });

    expect(cleaningMissedRoundExists([existing], zone, statuses[0].win, 0, 86400000)).toBe(true);
    expect(cleaningMissedRoundRecordsForStatuses({ zone, statuses, rounds: [existing], dayStart: 0, dayEnd: 86400000 })).toEqual([]);
  });
});
