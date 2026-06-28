import { describe, expect, it } from "vitest";
import { parseLocalNotificationPrefs, parseNotificationSeenAt } from "../src/notificationPrefsModel.js";

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
});
