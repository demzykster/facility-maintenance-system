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
        { id: "own-dept", subject: "Allowed", department: "הפצה", cost: 500, track: "transport", forkliftId: "fleet-120823", asset: "120823" },
        { id: "other-dept", subject: "Hidden", department: "קבלה", cost: 400 }
      ],
      fleet: [
        { id: "f1", code: "A", department: "הפצה" },
        { id: "f2", code: "B", department: "קבלה" }
      ],
      users: [
        { id: "manager-1", workerNo: "1", name: "Manager", role: "user", department: "הפצה" },
        { id: "worker-1", workerNo: "11032", name: "Worker", role: "worker", department: "הפצה", pinHash: "secret" },
        { id: "other-user", workerNo: "22000", name: "Hidden", role: "worker", department: "קבלה" },
        { id: "inactive-user", workerNo: "33000", name: "Inactive", role: "worker", department: "הפצה", active: false }
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
    expect(context.tickets[0]).toMatchObject({ id: "own-dept", department: "הפצה", forkliftId: "fleet-120823", asset: "120823" });
    expect(context.tickets[0]).not.toHaveProperty("cost");
    expect(context.fleet.map((unit) => unit.id)).toEqual(["f1"]);
    expect(context.users).toEqual([
      { id: "manager-1", workerNo: "1", name: "Manager", role: "user", department: "הפצה", departments: ["הפצה"], active: true },
      { id: "worker-1", workerNo: "11032", name: "Worker", role: "worker", department: "הפצה", departments: ["הפצה"], active: true }
    ]);
    expect(JSON.stringify(context.users)).not.toContain("secret");
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

  it("passes PPE catalog and only role-visible PPE requests without cost fields", () => {
    const raw = {
      ppe: {
        items: [
          { id: "vest", name: "אפוד", category: "hivis", sizes: ["אחיד"], totalStock: 4, minStock: 2, lowStock: false, unitCost: 25 },
          { id: "shoes", name: "נעליים", category: "shoes", sizes: ["42"], totalStock: 0, minStock: 1, lowStock: true }
        ],
        requests: [
          {
            id: "req-own",
            status: "pending",
            workerId: "worker-1",
            workerName: "Worker",
            workerNo: "11032",
            department: "הפצה",
            ageDays: 1,
            lines: [{ itemId: "vest", itemName: "אפוד", category: "hivis", size: "אחיד", qty: 1, unitCost: 25 }]
          },
          {
            id: "req-other",
            status: "pending",
            workerId: "worker-2",
            workerName: "Hidden",
            department: "קבלה",
            ageDays: 2,
            lines: [{ itemId: "shoes", itemName: "נעליים", category: "shoes", size: "42", qty: 1 }]
          }
        ]
      }
    };

    const context = buildAiAssistContext(raw, { id: "worker-1", role: "worker", workerNo: "11032", department: "הפצה" });

    expect(context.ppe.items.map((item) => item.id)).toEqual(["vest", "shoes"]);
    expect(context.ppe.requests.map((request) => request.id)).toEqual(["req-own"]);
    expect(context.ppe.requests[0].lines).toEqual([
      { itemId: "vest", itemName: "אפוד", category: "hivis", size: "אחיד", qty: 1 }
    ]);
    expect(JSON.stringify(context.ppe)).not.toContain("unitCost");
    expect(JSON.stringify(context.ppe)).not.toContain("Hidden");
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
