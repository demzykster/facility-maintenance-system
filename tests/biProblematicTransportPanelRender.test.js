import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BIProblematicTransportPanel } from "../src/BIProblematicTransportPanel.jsx";
import { PROBLEMATIC_TRANSPORT_REASON } from "../src/problematicTransportTicketsModel.js";

const baseProps = {
  rows: [{
    ticket: { id: "t-1", num: "T-001", subject: "בלמים חלשים", status: "done", createdAt: 1 },
    unit: { id: "fleet-1", code: "194340" },
    departments: ["מחסן"],
    downtimeMs: 60 * 60 * 1000 * 72,
    costAmount: 420,
    displayDate: 2,
    reasons: [
      PROBLEMATIC_TRANSPORT_REASON.UNNATURAL_DAMAGE,
      PROBLEMATIC_TRANSPORT_REASON.LONG_DOWNTIME,
      PROBLEMATIC_TRANSPORT_REASON.CLOSED_WITH_COST
    ]
  }],
  ticketNo: (ticket) => ticket.num,
  statusLabel: () => "סגורה",
  unitLabel: (unit) => unit.code,
  formatDuration: () => "3 ימים",
  formatCost: (value) => `₪${value}`,
  formatDate: () => "21.07.26"
};

describe("BI problematic transport panel", () => {
  it("renders one compact RTL row with all reasons and operational metadata", () => {
    const html = renderToString(React.createElement(BIProblematicTransportPanel, baseProps));

    expect(html).toContain("קריאות שינוע חריגות");
    expect(html).toContain("T-001");
    expect(html).toContain("194340");
    expect(html).toContain("בלמים חלשים");
    expect(html).toContain("סגורה");
    expect(html).toContain("מחסן");
    expect(html).toContain("3 ימים");
    expect(html).toContain("₪420");
    expect(html).toContain("נזק לא טבעי");
    expect(html).toContain("השבתה מעל יומיים");
    expect(html).toContain("נסגרה עם עלות");
    expect(html.match(/data-ticket-id="t-1"/g)).toHaveLength(1);
  });

  it("supports loading, error, and empty states", () => {
    expect(renderToString(React.createElement(BIProblematicTransportPanel, { ...baseProps, rows: [], loading: true }))).toContain("טוען קריאות שינוע חריגות");
    expect(renderToString(React.createElement(BIProblematicTransportPanel, { ...baseProps, rows: [], error: "שגיאה" }))).toContain("לא ניתן לטעון קריאות שינוע חריגות");
    expect(renderToString(React.createElement(BIProblematicTransportPanel, { ...baseProps, rows: [] }))).toContain("אין קריאות שינוע חריגות להצגה");
  });

  it("opens the existing ticket detail contract", () => {
    const onOpenTicket = vi.fn();
    const element = BIProblematicTransportPanel({ ...baseProps, onOpenTicket });
    const row = React.Children.toArray(element.props.children).find((child) => child?.props?.className === "bi-transport-problem-list");
    const button = React.Children.toArray(row.props.children)[0];

    button.props.onClick();
    expect(onOpenTicket).toHaveBeenCalledWith("t-1");
  });
});
