import { describe, expect, it } from "vitest";
import { buildAIContextSnapshot } from "../src/aiAssistSnapshotModel.js";

const day = 86400000;

describe("AI assist snapshot model", () => {
  it("builds compact operational context with metrics, tickets, fleet docs, PM, tasks, meetings, and heatmap", () => {
    const now = Date.UTC(2026, 6, 13, 8, 0, 0);
    const session = { id: "admin-1", name: "Vadim", role: "admin" };
    const fleet = [
      { id: "fork-1", code: "178040", type: "Toyota", department: "הפצה", supplier: "Toyota" },
      { id: "fork-2", code: "120823", type: "Reach", department: "קבלה" }
    ];
    const users = [
      { id: "admin-1", workerNo: "1", name: "Vadim", role: "admin", department: "הנהלה" },
      { id: "u2", workerNo: "11032", name: "Dana", role: "user", department: "הפצה", passwordHash: "secret" },
      { id: "inactive", workerNo: "999", name: "Inactive", role: "worker", department: "הפצה", active: false }
    ];
    const tickets = [
      {
        id: "ticket-1",
        num: 35,
        track: "transport",
        forkliftId: "fork-1",
        subject: "Brake failure",
        status: "waiting",
        waitingReason: "parts",
        priority: "high",
        assignee: "Vadim",
        supplier: "Toyota",
        createdAt: now - 9 * day,
        updatedAt: now - 4 * day,
        closure: { costAmount: 120 },
        reportedByName: "Worker"
      },
      {
        id: "ticket-2",
        subject: "Light issue",
        status: "new",
        priority: "medium",
        dept: "קבלה",
        createdAt: now - day,
        updatedAt: now - day,
        costAmount: 30
      },
      {
        id: "ticket-3",
        subject: "Closed",
        status: "done",
        priority: "low",
        dept: "הפצה",
        cost: 50
      }
    ];
    const pm = [
      { id: "pm-1", title: "Monthly PM", forkliftId: "fork-1", nextDue: now + 3 * day, active: true },
      { id: "pm-2", title: "Later PM", forkliftId: "fork-2", nextDue: now + 30 * day, active: true }
    ];
    const tasks = [
      {
        id: "task-1",
        title: "Approve supplier quote",
        status: "waiting",
        priority: "high",
        dueAt: now - day,
        updatedAt: now - day,
        responsibleIds: ["admin-1"],
        ownerId: "admin-1",
        waitingFor: "CFO",
        category: "budget",
        meetingId: "meet-1"
      },
      {
        id: "task-2",
        title: "Completed",
        status: "done",
        priority: "low",
        updatedAt: now - 2 * day
      }
    ];
    const meetings = [
      {
        id: "meet-1",
        title: "Ops weekly",
        type: "ops",
        status: "planned",
        at: now - day,
        ownerId: "admin-1",
        participantIds: ["admin-1"]
      },
      {
        id: "meet-2",
        title: "Next planning",
        type: "boss",
        status: "planned",
        at: now + 2 * day,
        participantIds: ["admin-1"]
      }
    ];

    const snapshot = buildAIContextSnapshot({
      session,
      tickets,
      pm,
      fleet,
      users,
      tasks,
      meetings,
      config: {
        departments: ["הפצה", "קבלה"],
        suppliers: ["Toyota", "BuildingCo"],
        supplierMeta: {
          Toyota: { type: "transport", industries: ["transport"], contacts: [{ name: "Secret" }] },
          BuildingCo: { industries: ["facility:hvac"] }
        }
      },
      now,
      isOpenTicket: (ticket) => ticket.status !== "done",
      isOverdueTicket: (ticket) => ticket.id === "ticket-1",
      requiresManagerAction: (_actor, ticket) => ticket.status === "new",
      ticketNumber: (ticket) => `F-${String(ticket.num || ticket.id).padStart(3, "0")}`,
      statusLabel: (status) => ({ waiting: "בהמתנה", new: "חדשה", done: "נסגרה" }[status] || status),
      priorityLabel: (priority) => ({ high: "גבוהה", medium: "בינונית", low: "נמוכה" }[priority] || priority),
      trackOf: (ticket) => ticket.track || "facility",
      waitReasonLabel: (ticket) => ticket.waitingReason ? "ממתינה לחלקים" : "",
      formatDateTime: () => "13.07.26 08:00",
      daysLeft: (timestamp) => Math.ceil((timestamp - now) / day),
      pmFleet: (task, units) => units.find((unit) => unit.id === task.forkliftId),
      docStatus: (unit) => unit.id === "fork-1" ? { d: 12, label: "12 ימים" } : { d: 80, label: "תקין" }
    });

    expect(snapshot.metrics).toMatchObject({
      openTickets: 2,
      overdueTickets: 1,
      waitingTickets: 1,
      pendingApprovals: 1,
      assignedToMe: 1,
      fleetDocsDue: 1,
      pmDue: 1,
      totalCost: 200
    });
    expect(snapshot.metrics).toMatchObject({
      openTasks: 1,
      overdueTasks: 1,
      waitingTasks: 1,
      plannedMeetings: 2,
      meetingsToSummarize: 1
    });
    expect(snapshot.tickets).toHaveLength(2);
    expect(snapshot.tickets[0]).toMatchObject({
      number: "F-035",
      status: "בהמתנה",
      priority: "גבוהה",
      waitReason: "ממתינה לחלקים",
      ageDays: 9,
      idleDays: 4,
      overdue: true,
      updatedAt: "13.07.26 08:00"
    });
    expect(snapshot.fleet).toEqual([
      {
        id: "fork-1",
        code: "178040",
        type: "Toyota",
        department: "הפצה",
        supplier: "Toyota",
        status: "12 ימים",
        docsDueDays: 12
      }
    ]);
    expect(snapshot.users).toEqual([
      {
        id: "admin-1",
        workerNo: "1",
        name: "Vadim",
        role: "admin",
        department: "הנהלה",
        departments: ["הנהלה"],
        active: true
      },
      {
        id: "u2",
        workerNo: "11032",
        name: "Dana",
        role: "user",
        department: "הפצה",
        departments: ["הפצה"],
        active: true
      }
    ]);
    expect(JSON.stringify(snapshot.users)).not.toContain("secret");
    expect(snapshot.pm).toEqual([
      {
        id: "pm-1",
        title: "Monthly PM",
        asset: "178040",
        department: "הפצה",
        dueDays: 3,
        status: "active"
      }
    ]);
    expect(snapshot.tasks).toEqual([
      {
        id: "task-1",
        title: "Approve supplier quote",
        status: "waiting",
        priority: "high",
        responsibleIds: ["admin-1"],
        ownerId: "admin-1",
        waitingFor: "CFO",
        category: "budget",
        meetingId: "meet-1",
        dueDays: -1,
        overdue: true,
        updatedAt: "13.07.26 08:00"
      }
    ]);
    expect(snapshot.meetings).toEqual([
      {
        id: "meet-1",
        title: "Ops weekly",
        type: "ops",
        status: "planned",
        ownerId: "admin-1",
        participantIds: ["admin-1"],
        openTaskCount: 1,
        meetingDays: -1,
        needsSummary: true
      },
      {
        id: "meet-2",
        title: "Next planning",
        type: "boss",
        status: "planned",
        participantIds: ["admin-1"],
        openTaskCount: 0,
        meetingDays: 2,
        needsSummary: false
      }
    ]);
    expect(snapshot.suppliers).toEqual([
      {
        name: "Toyota",
        type: "transport",
        scopes: ["transport"],
        fleetCount: 1,
        openTicketCount: 1
      },
      {
        name: "BuildingCo",
        type: "facility",
        scopes: ["facility:hvac"],
        fleetCount: 0,
        openTicketCount: 0
      }
    ]);
    expect(JSON.stringify(snapshot.suppliers)).not.toContain("Secret");
    expect(snapshot.bi.heatmap.map((row) => row.department)).toEqual(["הפצה", "קבלה"]);
    expect(snapshot.bi.heatmap[0]).toMatchObject({
      total: 1,
      primaryRisk: { key: "sla", value: 1 }
    });
  });

  it("limits large lists before sending context to the provider", () => {
    const tickets = Array.from({ length: 70 }, (_, index) => ({
      id: `ticket-${index}`,
      subject: `Ticket ${index}`,
      status: "new",
      priority: "low"
    }));

    const snapshot = buildAIContextSnapshot({
      tickets,
      maxTickets: 3,
      maxFleet: 0,
      maxPm: 0,
      maxHeatmapRows: 0
    });

    expect(snapshot.metrics.openTickets).toBe(70);
    expect(snapshot.tickets.map((ticket) => ticket.id)).toEqual(["ticket-0", "ticket-1", "ticket-2"]);
  });
});
