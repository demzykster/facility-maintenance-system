import { describe, expect, it } from "vitest";
import { APP_ISSUE_STATUS, appIssueStatusLabel, createAppIssue, updateAppIssueResponse } from "../src/appIssueModel.js";

describe("app issue model", () => {
  it("creates a compact app issue report with reporter and runtime context", () => {
    expect(createAppIssue({
      id: "issue-1",
      at: 123,
      description: "  כפתור לא מגיב  ",
      screenshot: "data:image/jpeg;base64,abc",
      location: "/settings",
      userAgent: "Vitest",
      session: { id: "u1", name: "Vadim", role: "admin", dept: "הנהלה", email: "v@example.com" },
    })).toEqual({
      id: "issue-1",
      at: 123,
      updatedAt: 123,
      status: "open",
      description: "כפתור לא מגיב",
      screenshot: "data:image/jpeg;base64,abc",
      location: "/settings",
      userAgent: "Vitest",
      reporter: { id: "u1", name: "Vadim", role: "admin", dept: "הנהלה", email: "v@example.com" },
      response: "",
      responseBy: "",
      responseAt: null,
    });
  });

  it("rejects empty descriptions and overly long reports", () => {
    expect(() => createAppIssue({ description: " " })).toThrow("description_required");
    expect(() => createAppIssue({ description: "x".repeat(1201) })).toThrow("description_too_long");
  });

  it("tracks admin reaction without changing the original report", () => {
    const issue = createAppIssue({ id: "issue-1", at: 100, description: "בעיה", session: { name: "User" } });

    expect(updateAppIssueResponse(issue, {
      response: "נבדק ונפתח תיקון",
      status: APP_ISSUE_STATUS.reviewing,
      actor: { name: "Vadim" },
      at: 200,
    })).toMatchObject({
      id: "issue-1",
      status: "reviewing",
      response: "נבדק ונפתח תיקון",
      responseBy: "Vadim",
      responseAt: 200,
      updatedAt: 200,
    });
  });

  it("uses stable Hebrew labels for settings history", () => {
    expect(appIssueStatusLabel(APP_ISSUE_STATUS.open)).toBe("פתוח");
    expect(appIssueStatusLabel(APP_ISSUE_STATUS.reviewing)).toBe("בבדיקה");
    expect(appIssueStatusLabel(APP_ISSUE_STATUS.resolved)).toBe("טופל");
  });
});
