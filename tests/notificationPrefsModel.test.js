import { describe, expect, it } from "vitest";
import {
  notificationReadStateForEvents,
  parseLocalNotificationPrefs,
  parseNotificationReadState,
  parseNotificationSeenAt,
  unreadNotificationKeySet
} from "../src/notificationPrefsModel.js";

describe("notification prefs model", () => {
  it("returns defaults when no local prefs exist", () => {
    expect(parseLocalNotificationPrefs(null)).toEqual({ sort: "newest", group: false, hidden: {} });
  });

  it("keeps valid saved preferences", () => {
    expect(parseLocalNotificationPrefs(JSON.stringify({ sort: "oldest", group: true, hidden: { sla: true } }))).toEqual({
      sort: "oldest",
      group: true,
      hidden: { sla: true }
    });
  });

  it("repairs invalid saved preferences", () => {
    expect(parseLocalNotificationPrefs("{bad")).toEqual({ sort: "newest", group: false, hidden: {} });
    expect(parseLocalNotificationPrefs(JSON.stringify({ hidden: "bad" }))).toEqual({ sort: "newest", group: false, hidden: {} });
  });

  it("reads local notification seen timestamps", () => {
    expect(parseNotificationSeenAt("1234")).toBe(1234);
    expect(parseNotificationSeenAt("bad")).toBe(0);
  });

  it("keeps legacy timestamp read-state compatible", () => {
    expect(parseNotificationReadState("1234")).toEqual({ seenAt: 1234, seenKeys: [] });
  });

  it("stores read notification keys with the latest seen time", () => {
    expect(notificationReadStateForEvents([{ key: "a", at: 100 }, { key: "b", at: 200 }, { key: "a", at: 300 }], 250)).toEqual({
      seenAt: 300,
      seenKeys: ["a", "b"]
    });
  });

  it("does not mark a stable key unread again when its timestamp moves", () => {
    const read = { seenAt: 1000, seenKeys: ["dynamic"] };

    expect(unreadNotificationKeySet([{ key: "dynamic", at: 2000 }, { key: "new", at: 2000 }], read)).toEqual(new Set(["new"]));
  });
});
