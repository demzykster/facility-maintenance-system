import { describe, expect, it } from "vitest";

import { buildInlineTicketIntakePlan } from "../src/inlineAiTicketIntakeOrchestrator.js";

const user = { id: "user-1", name: "Vadim", role: "user", dept: "הפצה" };

describe("inline AI ticket priority", () => {
  it("asks for transport priority after resolving the asset and accepts an explicit follow-up", () => {
    const context = { fleet: [{ id: "fleet-226", code: "226", department: "הפצה" }] };
    const first = buildInlineTicketIntakePlan({
      text: "תקלה במלגזה 226",
      context,
      fullVisibleFleet: context.fleet,
      user
    });

    expect(first).toMatchObject({ domain: "transport", status: "collecting", pendingField: "priority" });
    expect(first.draft).toMatchObject({ forkliftId: "fleet-226", priority: "" });
    expect(first.ticket).toBeUndefined();

    const ready = buildInlineTicketIntakePlan({
      text: "בינונית",
      latestText: "בינונית",
      previousIntake: first,
      context,
      fullVisibleFleet: context.fleet,
      user
    });

    expect(ready).toMatchObject({ status: "ready", pendingField: "", ticket: { track: "transport", priority: "medium", forkliftId: "fleet-226" } });
  });

  it("asks for facility priority without losing resolved category or location", () => {
    const config = {
      categories: [{ id: "hvac", label: "מיזוג אוויר" }],
      zones: ["משרדי הפצה"]
    };
    const first = buildInlineTicketIntakePlan({
      text: "מזגן לא עובד באזור משרדי הפצה",
      config,
      user
    });

    expect(first).toMatchObject({
      domain: "facility",
      status: "collecting",
      pendingField: "priority",
      draft: { category: "hvac", zone: "משרדי הפצה", priority: "" }
    });

    const ready = buildInlineTicketIntakePlan({
      text: "נמוכה",
      latestText: "נמוכה",
      previousIntake: first,
      config,
      user
    });

    expect(ready).toMatchObject({
      status: "ready",
      ticket: { track: "facility", category: "hvac", zone: "משרדי הפצה", priority: "low" }
    });
  });
});
