import { describe, expect, it } from "vitest";
import { biHeatmapAiPrompt, cleaningDashboardAiPrompt, fleetAiPrompt, ppeDashboardAiPrompt, supplierQueueAiPrompt, ticketAiPrompt } from "../src/aiAssistEntryPointModel.js";
import { AI_ASSIST_WORKFLOWS } from "../src/aiAssistWorkflowModel.js";

describe("AI assist entry point model", () => {
  it("builds a general heatmap risk prompt from top rows", () => {
    const prompt = biHeatmapAiPrompt({
      rows: [
        { name: "הפצה", total: 7, primaryRisk: { label: "SLA", value: 2 } },
        { name: "קבלה", total: 3, primaryRisk: { label: "ללא תנועה", value: 1 } }
      ]
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("נתח את מפת חום הקריאות");
    expect(prompt.text).toContain("הפצה: 7 פתוחות");
    expect(prompt.text).toContain("מוקד הסיכון המרכזי הוא SLA (2)");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a department-focused heatmap prompt", () => {
    const prompt = biHeatmapAiPrompt({
      row: { name: "שינוע", total: 4, primaryRisk: { label: "השבתה", value: 1 } }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("בתחום \"שינוע\"");
    expect(prompt.text).toContain("השבתה");
    expect(prompt.text).toContain("מה כדאי לבדוק קודם");
  });

  it("builds a cell-focused heatmap prompt without claiming any action", () => {
    const prompt = biHeatmapAiPrompt({
      row: { name: "מבנה", total: 5 },
      cell: { key: "stale", label: "ללא תנועה" }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("\"ללא תנועה\"");
    expect(prompt.text).toContain("\"מבנה\"");
    expect(prompt.text).toContain("למנהל לבדוק");
  });

  it("builds an SLA-focused ticket prompt from a specific ticket", () => {
    const prompt = ticketAiPrompt({
      ticket: { subject: "מזגן חדר הפצה", asset: "F-001", assignee: "יוסי" },
      labels: {
        number: "F-001",
        status: "בטיפול",
        priority: "גבוהה",
        track: "אחזקת מבנה",
        category: "מיזוג",
        waitReason: "ממתין לספק",
        slaBreached: true,
        age: "נפתחה 11.07.26 18:00"
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.slaExplanation);
    expect(prompt.text).toContain("קריאה #F-001");
    expect(prompt.text).toContain("מזגן חדר הפצה");
    expect(prompt.text).toContain("ממתין לספק");
    expect(prompt.text).toContain("חריגת SLA");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a next-action ticket prompt without claiming it changed anything", () => {
    const prompt = ticketAiPrompt({
      ticket: { id: "t1", subject: "רישיון רכב", asset: "מלגזה 120823", assignee: "" },
      labels: { status: "חדש", priority: "רגילה", track: "שינוע", slaBreached: false }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("מלגזה 120823");
    expect(prompt.text).toContain("טרם שויך");
    expect(prompt.text).toContain("לא מסומנת חריגת SLA");
    expect(prompt.text).not.toContain("עדכנתי");
  });

  it("builds a fleet risk prompt from a concrete unit", () => {
    const prompt = fleetAiPrompt({
      unit: { code: "120823", supplier: "טויוטה" },
      labels: {
        description: "מלגזת היגש RRE250E",
        departments: "שינוע",
        documentStatus: "רישיון רכב פג תוקף",
        serviceStatus: "פעיל",
        health: "68/100 · מעקב",
        openTickets: 2,
        totalTickets: 8,
        downtime: "4 שעות",
        recommendation: "לחדש רישיון ולבדוק קריאות חוזרות"
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("כלי שינוע 120823");
    expect(prompt.text).toContain("טויוטה");
    expect(prompt.text).toContain("רישיון רכב פג תוקף");
    expect(prompt.text).toContain("2 קריאות פתוחות");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a fleet next-action prompt for a healthy unit without inventing work", () => {
    const prompt = fleetAiPrompt({
      unit: { code: "236", supplier: "" },
      labels: { description: "מלגזת צריח MX-X", documentStatus: "תקין", serviceStatus: "פעיל", openTickets: 0 }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("מלגזת צריח MX-X");
    expect(prompt.text).toContain("אין קריאות פתוחות");
    expect(prompt.text).not.toContain("השבתתי");
  });

  it("builds a PPE stock risk prompt from dashboard metrics", () => {
    const prompt = ppeDashboardAiPrompt({
      labels: {
        activeItems: 36,
        pendingRequests: 4,
        lowItems: 7,
        outItems: 2,
        reorderItems: 5,
        reorderUnits: 31,
        openOrders: 3,
        monthlyIssues: 42,
        flaggedIssues: 2,
        employeeCharge: "₪450",
        topDeficits: ["נעלי בטיחות 43 חסר 4", "אוזניות מגן אחיד חסר 2"],
        recommendations: ["להעלות מינימום לנעלי בטיחות", "לבדוק הזמנה פתוחה מול ספק"]
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("ביגוד עובדים");
    expect(prompt.text).toContain("7 פריטים בחוסר");
    expect(prompt.text).toContain("2 פריטים אזלו");
    expect(prompt.text).toContain("נעלי בטיחות 43 חסר 4");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a PPE next-action prompt for a stable dashboard", () => {
    const prompt = ppeDashboardAiPrompt({
      labels: { activeItems: 12, lowItems: 0, outItems: 0, pendingRequests: 0, reorderItems: 0, openOrders: 0, monthlyIssues: 8 }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("אין כרגע חוסרים פתוחים");
    expect(prompt.text).not.toContain("אישרתי");
  });

  it("builds a cleaning risk prompt from today's operational state", () => {
    const prompt = cleaningDashboardAiPrompt({
      labels: {
        zones: 11,
        doneRounds: 18,
        totalRounds: 24,
        actionableRounds: 3,
        missedRounds: 2,
        pendingComplaints: 1,
        openComplaints: 4,
        escalatedComplaints: 1,
        absentCleaners: ["מאיה", "רונן"],
        unassignedZones: ["שירותים ראשי"],
        riskZones: ["לובי כניסה · סבב 14:00", "שירותים ראשי · פוספס"]
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("בקרת ניקיון");
    expect(prompt.text).toContain("18/24 סבבים בוצעו");
    expect(prompt.text).toContain("3 סבבים דורשים פעולה");
    expect(prompt.text).toContain("מאיה");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a cleaning next-action prompt for a clean day without claiming work was done", () => {
    const prompt = cleaningDashboardAiPrompt({
      labels: { zones: 5, doneRounds: 10, totalRounds: 10, actionableRounds: 0, missedRounds: 0, pendingComplaints: 0, openComplaints: 0 }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("אין כרגע סבבים באיחור");
    expect(prompt.text).not.toContain("סגרתי");
  });

  it("builds a supplier queue risk prompt from supplier summary rows", () => {
    const prompt = supplierQueueAiPrompt({
      labels: {
        totalSuppliers: 8,
        transportSuppliers: 3,
        facilitySuppliers: 2,
        goodsSuppliers: 1,
        untypedSuppliers: 2,
        openTickets: 6,
        openOrders: 2,
        linkedFleet: 123,
        linkedTechnicians: 4,
        missingContacts: 2,
        topSuppliers: ["טויוטה: 4 קריאות פתוחות", "ספק חלקים: 2 הזמנות פתוחות"]
      }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.riskSummary);
    expect(prompt.text).toContain("ספקים וקבלנים");
    expect(prompt.text).toContain("6 קריאות פתוחות");
    expect(prompt.text).toContain("2 הזמנות פתוחות");
    expect(prompt.text).toContain("טויוטה");
    expect(prompt.text).toContain("3 הפעולות הבטוחות הבאות");
  });

  it("builds a supplier queue next-action prompt when no supplier work is open", () => {
    const prompt = supplierQueueAiPrompt({
      labels: { totalSuppliers: 4, openTickets: 0, openOrders: 0, linkedFleet: 0, linkedTechnicians: 0, missingContacts: 0 }
    });

    expect(prompt.workflow).toBe(AI_ASSIST_WORKFLOWS.nextActions);
    expect(prompt.text).toContain("אין כרגע קריאות או הזמנות פתוחות אצל ספקים");
    expect(prompt.text).not.toContain("שייכתי");
  });
});
