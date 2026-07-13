import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketDetail } from "../src/TicketDetail.jsx";

const Icon = ({ children }) => React.createElement("span", null, children);
const Box = ({ children }) => React.createElement("div", null, children);
const Button = ({ children, label }) => React.createElement("button", null, children || label || "");

const componentNames = [
  "AlertTriangle", "CalendarClock", "Camera", "CheckCircle2", "ChevronLeft", "Clock", "Copy",
  "DollarSign", "Gauge", "HardHat", "History", "ListChecks", "MapPin", "Package", "PenLine",
  "Phone", "RefreshCw", "Search", "Send", "ShieldCheck", "Sparkles", "Trash2", "Truck",
  "User", "Wrench", "X"
];

function ticketDetailSmokeUi() {
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
    wReasons: () => []
  };
}

function smokeTicket(track) {
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
    supplier: track === "transport" ? "טויוטה" : "",
    createdBy: { id: "admin-1", name: "Vadim", role: "admin" },
    createdAt: now,
    updatedAt: now,
    dueAt: now + 86400000,
    log: [{ at: now, by: "Vadim", text: "נפתחה" }]
  };
}

function renderTicket(track) {
  return renderToString(React.createElement(TicketDetail, {
    ui: ticketDetailSmokeUi(),
    ticket: smokeTicket(track),
    tickets: [],
    fleet: [{ id: "fleet-1", code: "194340" }],
    users: [],
    config: {},
    session: { id: "admin-1", name: "Vadim", role: "admin" },
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
});
