import { describe, expect, it } from "vitest";
import { buildAiAssistContext } from "../src/aiAssistContextModel.js";

describe("AI assist context model", () => {
  it("keeps company and financial context for leadership roles", () => {
    const context = buildAiAssistContext({
      metrics: { openTickets: 2, totalCost: 900, estimatedCost: 1200 },
      tickets: [
        { id: "t1", subject: "A", department: "הפצה", cost: 700 },
        { id: "t2", subject: "B", department: "קבלה", cost: 200 }
      ]
    }, { role: "executive", department: "הנהלה" });

    expect(context.metrics).toMatchObject({ openTickets: 2, totalCost: 900, estimatedCost: 1200 });
    expect(context.tickets.map((ticket) => ticket.id)).toEqual(["t1", "t2"]);
    expect(context.tickets.map((ticket) => ticket.cost)).toEqual([700, 200]);
  });

  it("filters manager context to their departments and removes financial fields", () => {
    const context = buildAiAssistContext({
      metrics: { openTickets: 3, totalCost: 900 },
      tickets: [
        { id: "own-dept", subject: "Allowed", department: "הפצה", cost: 500 },
        { id: "other-dept", subject: "Hidden", department: "קבלה", cost: 400 }
      ],
      fleet: [
        { id: "f1", code: "A", department: "הפצה" },
        { id: "f2", code: "B", department: "קבלה" }
      ]
    }, { role: "user", departments: ["הפצה"] });

    expect(context.metrics).toEqual({ openTickets: 3 });
    expect(context.tickets).toHaveLength(1);
    expect(context.tickets[0]).toMatchObject({ id: "own-dept", department: "הפצה" });
    expect(context.tickets[0]).not.toHaveProperty("cost");
    expect(context.fleet.map((unit) => unit.id)).toEqual(["f1"]);
  });

  it("limits worker context to records reported by the same worker", () => {
    const context = buildAiAssistContext({
      tickets: [
        { id: "mine", subject: "My ticket", reportedBy: { id: "worker-1" }, department: "הפצה" },
        { id: "not-mine", subject: "Other ticket", reportedBy: { id: "worker-2" }, department: "הפצה" }
      ]
    }, { id: "worker-1", role: "worker", workerNo: "11032" });

    expect(context.tickets.map((ticket) => ticket.id)).toEqual(["mine"]);
  });
});
