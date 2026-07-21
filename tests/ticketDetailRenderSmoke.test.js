import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  applyFacilityAdminProcessingDraft,
  facilityAdminProcessingDraft,
  facilityAdminProcessingHasChanges,
  transportTicketSupplierName,
  TicketDetail
} from "../src/TicketDetail.jsx";
import { supplierCandidatesForTicket } from "../src/ticketSupplierFilterModel.js";

const Icon = ({ children }) => React.createElement("span", null, children);
const Box = ({ children }) => React.createElement("div", null, children);
const Button = ({ children, label }) => React.createElement("button", null, children || label || "");

const componentNames = [
  "AlertTriangle", "CalendarClock", "Camera", "CheckCircle2", "ChevronLeft", "Clock", "Copy",
  "DollarSign", "Gauge", "HardHat", "History", "ListChecks", "MapPin", "Package", "PenLine",
  "Phone", "RefreshCw", "Search", "Send", "ShieldCheck", "Sparkles", "Trash2", "Truck",
  "User", "Wrench", "X"
];

function ticketDetailSmokeUi(overrides = {}) {
  const components = Object.fromEntries(componentNames.map((name) => [name, Icon]));
  return {
    ...components,
    ConfirmBtn: Button,
    Meta: ({ label, value }) => React.createElement("div", null, `${label}: `, value || ""),
    SectionTitle: Box,
    SlaBar: Box,
    TicketCard: Button,
    CATEGORIES: [{ id: "building", label: "בניין", Icon, color: "#1F4E8C" }],
    PRIORITIES: [{ id: "low", label: "נמוכה", color: "#1F4E8C", bg: "#EAF0F8" }],
    REJECT_REASONS: [{ id: "duplicate", label: "כפילות" }],
    STATUSES: [{ id: "in_progress", label: "בטיפול", color: "#1F4E8C", bg: "#EAF0F8" }],
    WEAR: [{ id: "normal", label: "שחיקה רגילה" }],
    ADMIN_TICKET_DURATION_FIELDS: ["in_progress", "waiting:supplier"],
    TICKET_PHOTOS: { load: async () => "", save: async () => ({}) },
    TRACKS: {
      facility: { label: "מבנה", short: "מבנה", color: "#1F4E8C", Icon },
      transport: { label: "שינוע", short: "שינוע", color: "#1F4E8C", Icon }
    },
    applyAdminTicketManualEdit: (ticket) => ticket,
    canConfirmTicketForSession: () => false,
    catMeta: () => ({ Icon, color: "#1F4E8C" }),
    catOf: () => ({ id: "building", label: "בניין", Icon, color: "#1F4E8C" }),
    computeRisk: () => ({ level: "green", label: "תקין", color: "#16A34A" }),
    countLabel: (value, one, many) => `${value} ${value === 1 ? one : many}`,
    datetimeValueToMs: (value, fallback = null) => value ? Date.parse(value) : fallback,
    downtimeMs: () => 0,
    dtLevels: () => [{ id: "minor", label: "פעיל", color: "#1F4E8C" }],
    dtOf: () => ({ id: "minor", label: "פעיל", color: "#1F4E8C" }),
    entryFor: () => ({ at: Date.now(), by: "Vadim", text: "בדיקה" }),
    facilityOwnerPatch: () => ({}),
    fleetDeptOf: () => "מחסן",
    fmtDate: () => "11.07.26",
    fmtDur: () => "0 ד׳",
    fmtTime: () => "18:00",
    ils: (value) => `₪${value}`,
    inputDateTime: () => "2026-07-11T18:00",
    isOpen: () => true,
    normalizeFacilitySupplierPatch: (_ticket, patch) => patch,
    normalizedTicketLifecycleStages: () => [],
    ownsPendingUserTicket: () => false,
    pausePatch: () => ({}),
    prOf: () => ({ id: "low", label: "נמוכה", color: "#1F4E8C", bg: "#EAF0F8" }),
    reasonBall: () => "admin",
    reasonsForRole: () => [],
    rejectLabel: () => "כפילות",
    similarTickets: () => [],
    slaForTicket: () => 24,
    stOf: () => ({ id: "in_progress", label: "בטיפול", color: "#1F4E8C", bg: "#EAF0F8" }),
    statusMsToHours: () => ({}),
    supplierCandidatesForTicket: () => [],
    ticketAiPrompt: () => "בדיקה",
    ticketMissedSla: () => false,
    ticketNo: (ticket) => ticket.num || ticket.id,
    ticketWaitReasonLabel: () => "",
    trackOf: (ticket) => ticket.track || (ticket.forkliftId ? "transport" : "facility"),
    unitLabel: () => "194340",
    waitReasonLabel: () => "",
    waitReasonLifecycleMeta: () => ({}),
    wReasons: () => [],
    ...overrides
  };
}

function smokeTicket(track, patch = {}) {
  const now = Date.now();
  return {
    id: `${track}-1`,
    num: track === "transport" ? "T-001" : "F-001",
    track,
    subject: track === "transport" ? "כסא לא תקין" : "מזגן חדר הפצה",
    description: "בדיקת פתיחת כרטיס קריאה",
    status: "in_progress",
    priority: "low",
    category: track === "transport" ? "transport" : "building",
    categoryLabel: track === "transport" ? "כלי שינוע / מלגזות" : "בניין",
    zone: "משרדי מטה",
    asset: track === "transport" ? "194340" : "חדר הפצה",
    forkliftId: track === "transport" ? "fleet-1" : null,
    downtimeType: track === "transport" ? "minor" : null,
    supplier: track === "transport" ? "טויוטה ישן" : "",
    createdBy: { id: "admin-1", name: "Vadim", role: "admin" },
    createdAt: now,
    updatedAt: now,
    dueAt: now + 86400000,
    log: [{ at: now, by: "Vadim", text: "נפתחה" }],
    ...patch
  };
}

function renderTicket(track, options = {}) {
  return renderToString(React.createElement(TicketDetail, {
    ui: ticketDetailSmokeUi(options.ui || {}),
    ticket: smokeTicket(track, options.ticket || {}),
    tickets: [],
    fleet: [{ id: "fleet-1", code: "194340", supplier: "טויוטה" }],
    users: [],
    config: options.config || {},
    session: options.session || { id: "admin-1", name: "Vadim", role: "admin" },
    saveTicket: () => true,
    onBack: () => {}
  }));
}

describe("ticket detail render smoke", () => {
  it("renders a facility ticket detail without runtime bridge errors", () => {
    expect(renderTicket("facility")).toContain("מזגן חדר הפצה");
  });

  it("renders a transport ticket detail without runtime bridge errors", () => {
    expect(renderTicket("transport")).toContain("כסא לא תקין");
  });

  it("shows transport supplier once as top read-only context instead of a lower route selector", () => {
    const html = renderTicket("transport");

    expect(html.match(/ספק כלי/g)).toHaveLength(1);
    expect(html).toContain("טויוטה");
    expect(html).toContain("טויוטה · טרם נלקח ע״י טכנאי");
    expect(html).not.toContain("שיוך ספק / קבלן");
  });

  it("shows transport responsible as supplier plus technician after technician accepts", () => {
    const html = renderTicket("transport", { ticket: { assignee: "Igor" } });

    expect(html).toContain("אחראי: ");
    expect(html).toContain("טויוטה · Igor");
  });

  it("keeps transport admin in control mode until execution actions are explicitly shown", () => {
    const html = renderTicket("transport");

    expect(html).toContain("הצג פעולות ביצוע חריגות");
    expect(html).toContain("סגירה סופית ואישור עלות");
    expect(html).not.toContain("קבל לטיפול");
    expect(html).not.toContain("סיווג מקור התקלה");
    expect(html).not.toContain("סיום טיפול");
  });

  it("shows pending requester approval as a decision screen without admin close controls", () => {
    const html = renderTicket("transport", {
      ticket: { status: "pending_user", assignee: "Tech" },
      ui: { canConfirmTicketForSession: () => true }
    });

    expect(html).toContain("אישור ביצוע");
    expect(html).toContain("הטכנאי דיווח שהתקלה טופלה");
    expect(html).toContain("אישור — טופל");
    expect(html).toContain("הבעיה לא נפתרה");
    expect(html).not.toContain("סגירה סופית ואישור עלות");
    expect(html).not.toContain("הצג פעולות ביצוע חריגות");
    expect(html).not.toContain("שמירת שינויים");
  });

  it("derives transport supplier from the linked fleet unit before legacy ticket data", () => {
    expect(transportTicketSupplierName(
      { track: "transport", forkliftId: "fleet-1", supplier: "Legacy" },
      [{ id: "fleet-1", supplier: "טויוטה" }]
    )).toBe("טויוטה");
    expect(transportTicketSupplierName(
      { track: "transport", forkliftId: "missing", supplier: "Legacy" },
      []
    )).toBe("Legacy");
  });

  it("keeps facility admin waiting edits as a draft until explicit save", () => {
    const ticket = {
      id: "facility-1",
      track: "facility",
      status: "in_progress",
      waitingReason: "",
      supplier: "",
      log: [{ at: 1, by: "Vadim", text: "נפתחה" }]
    };
    const draft = facilityAdminProcessingDraft(ticket);
    const clicked = { ...draft, waitingReason: "supplier", waitingSupplier: "Quote Co" };

    expect(facilityAdminProcessingHasChanges(ticket, clicked)).toBe(true);
    expect(ticket.status).toBe("in_progress");
    expect(ticket.log).toHaveLength(1);

    const next = applyFacilityAdminProcessingDraft(ticket, clicked, {
      now: 2,
      session: { name: "Vadim", role: "admin" },
      entryFor: (_session, text, kind) => ({ at: 2, by: "Vadim", text, kind }),
      pausePatch: () => ({ pauseSince: 2 }),
      reasonBall: () => "admin",
      waitReasonLabel: () => "ממתינה לספק"
    });

    expect(next.status).toBe("waiting");
    expect(next.waitingReason).toBe("supplier");
    expect(next.waitingSupplier).toBe("Quote Co");
    expect(next.waitingTargetType).toBe("supplier");
    expect(next.log).toHaveLength(2);
    expect(next.log[1]).toMatchObject({ text: "ממתין · ממתינה לספק", kind: "waiting" });
  });

  it("does not change the assigned supplier through the facility waiting draft", () => {
    const ticket = {
      id: "facility-1",
      track: "facility",
      status: "in_progress",
      waitingReason: "",
      supplier: "Execution Co",
      assignee: "Technician",
      routedTech: true,
      log: []
    };
    const next = applyFacilityAdminProcessingDraft(ticket, {
      supplier: "Wrong Co",
      waitingReason: "supplier",
      waitingSupplier: "Quote Co",
      note: "נבדק מול ספק"
    }, {
      now: 3,
      session: { name: "Vadim", role: "admin" },
      entryFor: (_session, text, kind) => ({ at: 3, by: "Vadim", text, kind }),
      normalizeFacilitySupplierPatch: () => { throw new Error("waiting workflow must not route execution"); },
      pausePatch: () => ({}),
      reasonBall: () => "admin",
      waitReasonLabel: () => "ממתינה לספק"
    });

    expect(next).toMatchObject({
      supplier: "Execution Co",
      assignee: "Technician",
      routedTech: true,
      status: "waiting",
      waitingReason: "supplier",
      waitingTargetType: "supplier",
      waitingSupplier: "Quote Co",
      updatedAt: 3
    });
    expect(next.log.map((entry) => entry.text)).toEqual([
      "ממתין · ממתינה לספק",
      "נבדק מול ספק"
    ]);
  });

  it("stores a waiting supplier without changing the assigned execution supplier", () => {
    const ticket = {
      id: "facility-1",
      track: "facility",
      status: "in_progress",
      supplier: "Execution Co",
      assignee: "Technician",
      routedTech: true,
      log: []
    };

    const next = applyFacilityAdminProcessingDraft(ticket, {
      ...facilityAdminProcessingDraft(ticket),
      waitingReason: "supplier",
      waitingSupplier: "Quote Co"
    }, {
      now: 4,
      session: { name: "Vadim", role: "admin" },
      entryFor: (_session, text, kind) => ({ at: 4, by: "Vadim", text, kind }),
      normalizeFacilitySupplierPatch: () => { throw new Error("routing must not change"); },
      pausePatch: () => ({}),
      reasonBall: () => "admin",
      waitReasonLabel: () => "ממתינה לספק"
    });

    expect(next).toMatchObject({
      supplier: "Execution Co",
      assignee: "Technician",
      routedTech: true,
      waitingTargetType: "supplier",
      waitingSupplier: "Quote Co"
    });
  });

  it("displays the explicit waiting target separately from the wait reason", () => {
    const html = renderTicket("facility", {
      ticket: {
        status: "waiting",
        waitingReason: "supplier",
        waitingTargetType: "supplier",
        waitingSupplier: "Quote Co"
      },
      ui: {
        waitReasonLabel: () => "ממתינה לספק",
        ticketWaitReasonLabel: () => "ממתינה לספק"
      }
    });

    expect(html).toContain("יעד המתנה");
    expect(html).toContain("Quote Co");
  });

  it("shows only category-relevant suppliers in the facility waiting target", () => {
    const config = {
      suppliers: ["Building Co", "Toyota"],
      supplierMeta: {
        "Building Co": { type: "facility", industries: ["facility:building"] },
        Toyota: { type: "transport", industries: ["transport"] }
      }
    };
    const html = renderTicket("facility", {
      config,
      ticket: {
        status: "waiting",
        waitingReason: "supplier",
        waitingTargetType: "supplier",
        waitingSupplier: "Building Co"
      },
      ui: { supplierCandidatesForTicket }
    });

    expect(html).toContain("ספק שממתינים לו");
    expect(html).toContain("Building Co");
    expect(html).not.toContain(">Toyota<");
    expect(html).not.toContain("שיוך ספק / קבלן");
  });

  it("keeps facility supplier routing available during initial report approval", () => {
    const config = {
      suppliers: ["Building General", "Toyota"],
      supplierMeta: {
        "Building General": { type: "facility", industries: [] },
        Toyota: { type: "transport", industries: ["transport"] }
      }
    };
    const html = renderTicket("facility", {
      config,
      ticket: { status: "pending_manager" },
      ui: { supplierCandidatesForTicket }
    });

    expect(html).toContain("לאחר אישור — מי מטפל?");
    expect(html).toContain("supplier:Building General");
    expect(html).not.toContain("supplier:Toyota");
  });
});
