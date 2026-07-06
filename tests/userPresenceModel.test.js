import { describe, expect, it } from "vitest";
import {
  isPresenceOnline,
  presenceRecordForUser,
  relativePresenceTime,
  shiftPresenceStatusText,
  userPresenceStatusText
} from "../src/userPresenceModel.js";

describe("user presence model", () => {
  const now = new Date("2026-07-06T12:00:00.000Z").getTime();

  it("does not treat an old on-shift technician heartbeat as online", () => {
    const record = presenceRecordForUser([
      { id: "tech-1", onShift: true, day: "2026-07-06", lastSeen: now - 10 * 60 * 60 * 1000 }
    ], "tech-1", { todayKey: "2026-07-06" });

    expect(record.onShift).toBe(true);
    expect(isPresenceOnline(record, { now })).toBe(false);
    expect(shiftPresenceStatusText(record, { now })).toBe("במשמרת · נראה לאחרונה לפני 10 שע׳");
  });

  it("marks only fresh heartbeats as online", () => {
    expect(isPresenceOnline({ lastSeen: now - 90 * 1000 }, { now })).toBe(true);
    expect(isPresenceOnline({ lastSeen: now - 3 * 60 * 1000 }, { now })).toBe(false);
    expect(userPresenceStatusText({ lastSeen: now - 90 * 1000 }, { now })).toBe("פעיל כעת");
  });

  it("shows stable last-seen wording for inactive users", () => {
    expect(relativePresenceTime(now - 45 * 60 * 1000, { now })).toBe("לפני 45 ד׳");
    expect(userPresenceStatusText({ lastSeen: now - 2 * 24 * 60 * 60 * 1000 }, { now })).toBe("נראה לאחרונה לפני 2 ימים");
    expect(userPresenceStatusText({}, { now })).toBe("לא נראה במערכת");
  });
});
