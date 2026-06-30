import { describe, expect, it } from "vitest";
import { groupSystemErrorLogs, systemErrorGroupKey } from "../src/systemErrorLogAdapter.js";

describe("system error log adapter", () => {
  it("builds a stable group key from the operational error boundary", () => {
    expect(systemErrorGroupKey({
      kind: "storage_save_failed",
      operation: "set",
      key: "fleet:v1",
      path: "/fleet"
    })).toBe("storage_save_failed|set|fleet:v1|/fleet");
  });

  it("groups repeated system errors and keeps the newest event first", () => {
    const groups = groupSystemErrorLogs([
      {
        id: "old",
        at: 100,
        kind: "storage_save_failed",
        operation: "set",
        key: "fleet:v1",
        path: "/fleet",
        actorName: "Owner",
        errorId: "err-old"
      },
      {
        id: "new",
        at: 300,
        kind: "storage_save_failed",
        operation: "set",
        key: "fleet:v1",
        path: "/fleet",
        actorName: "Owner",
        errorId: "err-new"
      },
      {
        id: "other",
        at: 200,
        kind: "storage_delete_failed",
        operation: "del",
        key: "ticket:1",
        path: "/tickets",
        actorName: "Manager"
      }
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "storage_save_failed|set|fleet:v1|/fleet",
      count: 2,
      latestAt: 300,
      errorId: "err-new"
    });
    expect(groups[0].items.map((item) => item.id)).toEqual(["new", "old"]);
    expect(groups[1]).toMatchObject({
      key: "storage_delete_failed|del|ticket:1|/tickets",
      count: 1,
      latestAt: 200
    });
  });
});
