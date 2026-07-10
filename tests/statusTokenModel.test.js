import { describe, expect, it } from "vitest";
import { priorityToken, statusTokenTone, taskStatusToken, ticketStatusToken } from "../src/statusTokenModel.js";

describe("statusTokenModel", () => {
  it("uses stable semantic colors for priority severity", () => {
    expect(priorityToken("high")).toMatchObject({ tone: "danger", color: "#B91C1C", bg: "#FEE2E2" });
    expect(priorityToken("medium")).toMatchObject({ tone: "warning", color: "#92400E", bg: "#FEF3C7" });
    expect(priorityToken("low")).toMatchObject({ tone: "success", color: "#166534", bg: "#DCFCE7" });
  });

  it("keeps task statuses on the shared status-token vocabulary", () => {
    expect(taskStatusToken("todo").tone).toBe("neutral");
    expect(taskStatusToken("in_progress").tone).toBe("info");
    expect(taskStatusToken("waiting").tone).toBe("warning");
    expect(taskStatusToken("done").tone).toBe("success");
    expect(taskStatusToken("cancelled").tone).toBe("neutral");
  });

  it("keeps ticket statuses distinguishable without ad hoc color literals", () => {
    expect(ticketStatusToken("new").tone).toBe("info");
    expect(ticketStatusToken("in_progress").tone).toBe("process");
    expect(ticketStatusToken("waiting").tone).toBe("accent");
    expect(ticketStatusToken("pending_admin").tone).toBe("indigo");
    expect(ticketStatusToken("done").tone).toBe("success");
  });

  it("falls back to neutral for unknown tone or status ids", () => {
    expect(statusTokenTone("missing")).toEqual(statusTokenTone("neutral"));
    expect(ticketStatusToken("missing")).toMatchObject({ tone: "neutral", color: "#475569" });
  });
});
