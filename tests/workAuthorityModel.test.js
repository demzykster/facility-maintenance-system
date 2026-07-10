import { describe, expect, it, vi } from "vitest";
import { normalizedWorkAuthorityEnabled, workAuthorityFailureIssue, workForAuthority } from "../src/workAuthorityModel.js";

describe("work authority model", () => {
  it("enables normalized work authority only for production API provider", () => {
    expect(normalizedWorkAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedWorkAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedWorkAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
  });

  it("falls back to KV rows when normalized authority is disabled", async () => {
    await expect(workForAuthority({
      kvTasks: [{ id: "task-1" }],
      kvMeetings: [{ id: "meet-1" }],
      normalizedAuthority: false
    })).resolves.toEqual({
      tasks: [{ id: "task-1" }],
      meetings: [{ id: "meet-1" }],
      source: "kv"
    });
  });

  it("loads tasks and meetings from the normalized provider", async () => {
    const provider = {
      tasks: { list: vi.fn().mockResolvedValue({ tasks: [{ id: "task-1" }] }) },
      meetings: { list: vi.fn().mockResolvedValue({ meetings: [{ id: "meet-1" }] }) }
    };

    await expect(workForAuthority({ provider, normalizedAuthority: true })).resolves.toEqual({
      tasks: [{ id: "task-1" }],
      meetings: [{ id: "meet-1" }],
      source: "normalized"
    });
  });

  it("builds failure issues for automatic reporting", () => {
    expect(workAuthorityFailureIssue({ action: "save", resource: "tasks", id: "task-1", message: "boom" })).toEqual({
      kind: "work_normalized_tasks_save_failed",
      action: "save",
      key: "work:tasks:task-1",
      message: "boom"
    });
  });
});
