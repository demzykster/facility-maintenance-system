import { describe, expect, it } from "vitest";
import { buildAiAssistContext } from "../src/aiAssistContextModel.js";

describe("AI assist context model", () => {
  it("keeps company and financial context for leadership roles", () => {
    const context = buildAiAssistContext({
      metrics: { openTickets: 2, totalCost: 900, estimatedCost: 1200 },
      bi: {
        heatmap: [
          { department: "הפצה", total: 2, primaryRisk: { key: "sla", label: "SLA", value: 1 }, riskTags: [{ key: "sla", label: "SLA", value: 1 }] },
          { department: "קבלה", total: 1, primaryRisk: { key: "waiting", label: "ממתין", value: 1 }, riskTags: [{ key: "waiting", label: "ממתין", value: 1 }] }
        ]
      },
      tickets: [
        { id: "t1", subject: "A", department: "הפצה", cost: 700 },
        { id: "t2", subject: "B", department: "קבלה", cost: 200 }
      ],
      suppliers: [
        { name: "Toyota", type: "transport", scopes: ["transport"], fleetCount: 2, openTicketCount: 1 }
      ]
    }, { role: "executive", department: "הנהלה" });

    expect(context.metrics).toMatchObject({ openTickets: 2, totalCost: 900, estimatedCost: 1200 });
    expect(context.bi.heatmap.map((row) => row.department)).toEqual(["הפצה", "קבלה"]);
    expect(context.tickets.map((ticket) => ticket.id)).toEqual(["t1", "t2"]);
    expect(context.tickets.map((ticket) => ticket.cost)).toEqual([700, 200]);
    expect(context.suppliers).toEqual([
      { name: "Toyota", type: "transport", scopes: ["transport"], fleetCount: 2, openTicketCount: 1 }
    ]);
  });

  it("filters manager context to their departments and removes financial fields", () => {
    const context = buildAiAssistContext({
      metrics: { openTickets: 3, totalCost: 900 },
      bi: {
        heatmap: [
          { department: "הפצה", total: 2, primaryRisk: { key: "sla", label: "SLA", value: 1 }, riskTags: [{ key: "sla", label: "SLA", value: 1 }] },
          { department: "קבלה", total: 1, primaryRisk: { key: "critical", label: "השבתה", value: 1 }, riskTags: [{ key: "critical", label: "השבתה", value: 1 }] }
        ]
      },
      tickets: [
        { id: "own-dept", subject: "Allowed", department: "הפצה", cost: 500 },
        { id: "other-dept", subject: "Hidden", department: "קבלה", cost: 400 }
      ],
      fleet: [
        { id: "f1", code: "A", department: "הפצה" },
        { id: "f2", code: "B", department: "קבלה" }
      ],
      tasks: [
        { id: "task-own", title: "Allowed task", department: "הפצה", responsibleIds: ["manager-1"], status: "waiting", waitingFor: "CFO", dueDays: -2, dueAt: 5000, overdue: true },
        { id: "task-other", title: "Hidden task", department: "קבלה", responsibleIds: ["manager-2"], status: "todo" }
      ],
      meetings: [
        { id: "meeting-own", title: "Allowed meeting", department: "הפצה", participantIds: ["manager-1"], meetingDays: -1, needsSummary: true },
        { id: "meeting-other", title: "Hidden meeting", department: "קבלה", participantIds: ["manager-2"] }
      ],
      suppliers: [
        { name: "Toyota", type: "transport", scopes: ["transport"], fleetCount: 2, openTicketCount: 1 }
      ]
    }, { id: "manager-1", role: "user", departments: ["הפצה"] });

    expect(context.metrics).toEqual({ openTickets: 3 });
    expect(context.bi.heatmap).toEqual([
      expect.objectContaining({
        department: "הפצה",
        total: 2,
        primaryRisk: { key: "sla", label: "SLA", value: 1 },
        riskTags: [{ key: "sla", label: "SLA", value: 1 }]
      })
    ]);
    expect(context.tickets).toHaveLength(1);
    expect(context.tickets[0]).toMatchObject({ id: "own-dept", department: "הפצה" });
    expect(context.tickets[0]).not.toHaveProperty("cost");
    expect(context.fleet.map((unit) => unit.id)).toEqual(["f1"]);
    expect(context.tasks).toEqual([
      {
        id: "task-own",
        title: "Allowed task",
        status: "waiting",
        department: "הפצה",
        responsibleIds: ["manager-1"],
        waitingFor: "CFO",
        dueDays: -2,
        dueAt: 5000,
        overdue: true
      }
    ]);
    expect(context.meetings).toEqual([
      {
        id: "meeting-own",
        title: "Allowed meeting",
        department: "הפצה",
        participantIds: ["manager-1"],
        meetingDays: -1,
        needsSummary: true
      }
    ]);
    expect(context.suppliers).toEqual([]);
  });

  it("passes compact supplier context only to users with supplier visibility", () => {
    const raw = {
      suppliers: [
        { name: "Toyota", type: "transport", scopes: ["transport"], fleetCount: 2, openTicketCount: 1, contacts: [{ phone: "secret" }] },
        { name: "BuildingCo", type: "facility", scopes: ["facility:hvac"], fleetCount: 0, openTicketCount: 3 }
      ]
    };

    const context = buildAiAssistContext(raw, { role: "user", departments: ["הפצה"], perms: { suppliers: "view" } });

    expect(context.profile.canSeeSuppliers).toBe(true);
    expect(context.suppliers).toEqual([
      { name: "Toyota", type: "transport", scopes: ["transport"], fleetCount: 2, openTicketCount: 1 },
      { name: "BuildingCo", type: "facility", scopes: ["facility:hvac"], fleetCount: 0, openTicketCount: 3 }
    ]);
    expect(JSON.stringify(context.suppliers)).not.toContain("secret");
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
