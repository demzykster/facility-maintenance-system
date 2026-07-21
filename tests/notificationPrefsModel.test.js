import { describe, expect, it } from "vitest";
import {
  browserNotificationEvents,
  initialBrowserNotificationState,
  mergeNotificationReadStates,
  nextBrowserNotificationEvent,
  notificationDisplayEvents,
  notificationReadStateForEvents,
  notificationReadStorageKeys,
  parseBrowserNotificationState,
  parseLocalNotificationPrefs,
  parseNotificationReadState,
  parseNotificationSeenAt,
  pruneBrowserNotificationState,
  unreadNotificationKeySet
} from "../src/notificationPrefsModel.js";

describe("notification prefs model", () => {
  it("returns defaults when no local prefs exist", () => {
    expect(parseLocalNotificationPrefs(null)).toEqual({ sort: "newest", group: false, showRead: false, hidden: {} });
  });

  it("keeps valid saved preferences", () => {
    expect(parseLocalNotificationPrefs(JSON.stringify({ sort: "oldest", group: true, showRead: true, hidden: { sla: true } }))).toEqual({
      sort: "oldest",
      group: true,
      showRead: true,
      hidden: { sla: true }
    });
  });

  it("repairs invalid saved preferences", () => {
    expect(parseLocalNotificationPrefs("{bad")).toEqual({ sort: "newest", group: false, showRead: false, hidden: {} });
    expect(parseLocalNotificationPrefs(JSON.stringify({ hidden: "bad" }))).toEqual({ sort: "newest", group: false, showRead: false, hidden: {} });
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

  it("uses a stable user id for personal notification read storage", () => {
    expect(notificationReadStorageKeys({ id: "user-1", role: "user", name: "Vadim" })).toEqual({
      primary: "seen:user-1",
      legacy: "seen:user:Vadim"
    });
    expect(notificationReadStorageKeys({ role: "user", name: "Vadim" })).toEqual({
      primary: "seen:user:Vadim",
      legacy: null
    });
  });

  it("merges legacy and current personal read-state without losing read keys", () => {
    const current = JSON.stringify({ seenAt: 2000, seenKeys: ["ticket-1"] });
    const legacy = JSON.stringify({ seenAt: 1000, seenKeys: ["doc-1", "ticket-1"] });

    expect(mergeNotificationReadStates(current, legacy)).toEqual({
      seenAt: 2000,
      seenKeys: ["ticket-1", "doc-1"]
    });
  });

  it("does not mark a stable key unread again when its timestamp moves", () => {
    const read = { seenAt: 1000, seenKeys: ["dynamic"] };

    expect(unreadNotificationKeySet([{ key: "dynamic", at: 2000 }, { key: "new", at: 2000 }], read)).toEqual(new Set(["new"]));
  });

  it("hides read notifications from the panel unless history is requested", () => {
    const events = [{ key: "read", at: 1000 }, { key: "new", at: 2000 }];
    const unread = new Set(["new"]);

    expect(notificationDisplayEvents(events, unread, { showRead: false })).toEqual([{ key: "new", at: 2000 }]);
    expect(notificationDisplayEvents(events, unread, { showRead: true })).toEqual(events);
  });

  it("does not fire a browser notification again for the same event key", () => {
    const state = initialBrowserNotificationState([{ key: "doc-194336", at: 1000 }]);

    expect(nextBrowserNotificationEvent([{ key: "doc-194336", at: 2000 }], state)).toEqual({
      event: null,
      maxAt: 2000,
      notifiedKeys: ["doc-194336"]
    });
  });

  it("fires a browser notification once for a new event key", () => {
    const state = initialBrowserNotificationState([{ key: "doc-194336", at: 1000 }]);
    const first = nextBrowserNotificationEvent([{ key: "doc-194336", at: 2000 }, { key: "doc-194337", at: 2000 }], state);

    expect(first.event).toEqual({ key: "doc-194337", at: 2000 });
    expect(nextBrowserNotificationEvent([{ key: "doc-194337", at: 3000 }], first).event).toBeNull();
  });

  it("allows waiting return reminders to become browser notifications", () => {
    expect(browserNotificationEvents([
      { key: "wait-return-ticket-1-1000", at: 1000, kind: "waiting" }
    ])).toEqual([{ key: "wait-return-ticket-1-1000", at: 1000, kind: "waiting" }]);
  });

  it("throttles browser notifications while still remembering skipped event keys", () => {
    const first = nextBrowserNotificationEvent(
      [{ key: "ticket-1", at: 1000 }],
      { maxAt: 0, notifiedKeys: [] },
      { now: 10_000, minIntervalMs: 30_000 }
    );
    const second = nextBrowserNotificationEvent(
      [{ key: "ticket-2", at: 2000 }],
      first,
      { now: 20_000, minIntervalMs: 30_000 }
    );

    expect(first.event).toEqual({ key: "ticket-1", at: 1000 });
    expect(first.lastNotifiedAt).toBe(10_000);
    expect(second).toMatchObject({
      event: null,
      maxAt: 2000,
      notifiedKeys: ["ticket-1", "ticket-2"],
      lastNotifiedAt: 10_000
    });
  });

  it("allows the next browser notification after the throttle window", () => {
    const result = nextBrowserNotificationEvent(
      [{ key: "ticket-2", at: 2000 }],
      { maxAt: 1000, notifiedKeys: ["ticket-1"], lastNotifiedAt: 10_000 },
      { now: 50_000, minIntervalMs: 30_000 }
    );

    expect(result.event).toEqual({ key: "ticket-2", at: 2000 });
    expect(result.lastNotifiedAt).toBe(50_000);
  });

  it("keeps browser notification state stable across reloads", () => {
    const first = nextBrowserNotificationEvent([{ key: "ticket-1", at: 1000 }], { maxAt: 0, notifiedKeys: [] });
    const restored = parseBrowserNotificationState(JSON.stringify(first));

    expect(nextBrowserNotificationEvent([{ key: "ticket-1", at: 2000 }], restored)).toMatchObject({
      event: null,
      maxAt: 2000,
      notifiedKeys: ["ticket-1"]
    });
  });

  it("bounds persisted browser notification keys", () => {
    const keys = Array.from({ length: 620 }, (_, index) => `event-${index}`);

    expect(pruneBrowserNotificationState({ maxAt: 10, notifiedKeys: keys }).notifiedKeys).toHaveLength(500);
    expect(parseBrowserNotificationState("{bad")).toEqual({ maxAt: 0, notifiedKeys: [] });
  });

  it("keeps backlog-style events out of browser notifications", () => {
    expect(browserNotificationEvents([
      { key: "doc-1", kind: "doc" },
      { key: "pm-1", kind: "pm" },
      { key: "ppe-low-admin", kind: "ppe" },
      { key: "sh-on-tech-1", kind: "confirm" },
      { key: "sh-off-tech-1", kind: "back" },
      { key: "ticket-1-c", kind: "new" },
      { key: "ticket-1-sla", kind: "sla" },
      { key: "cmp-1", kind: "cleaning" }
    ])).toEqual([
      { key: "ticket-1-c", kind: "new" },
      { key: "ticket-1-sla", kind: "sla" },
      { key: "cmp-1", kind: "cleaning" }
    ]);
  });
});
