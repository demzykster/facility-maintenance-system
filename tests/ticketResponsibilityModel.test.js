import { describe, expect, it } from "vitest";
import {
  normalizeTransportCreateResponsibility,
  ticketHolderLabel,
  ticketResponsibleLabel,
  transportTicketSupplierName
} from "../src/ticketResponsibilityModel.js";

describe("ticket responsibility model", () => {
  const fleet = [{ id: "fork-1", supplier: "טויוטה" }];

  it("routes a new transport ticket to the supplier pool instead of the opener", () => {
    const ticket = {
      id: "ticket-1",
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      supplier: "טויוטה",
      assignee: "Vadim",
      routedTech: false,
      createdBy: { name: "Vadim", role: "user" }
    };

    expect(normalizeTransportCreateResponsibility(ticket)).toMatchObject({
      assignee: "",
      routedTech: true
    });
  });

  it("does not clear technician ownership on existing transport updates", () => {
    const ticket = {
      id: "ticket-1",
      track: "transport",
      status: "new",
      supplier: "טויוטה",
      assignee: "Igor",
      routedTech: true
    };

    expect(normalizeTransportCreateResponsibility(ticket, { id: "ticket-1" })).toBe(ticket);
  });

  it("shows supplier pool before a technician accepts and supplier plus technician after accept", () => {
    const waiting = { track: "transport", forkliftId: "fork-1", assignee: "" };
    const accepted = { ...waiting, assignee: "Igor" };

    expect(transportTicketSupplierName(waiting, fleet)).toBe("טויוטה");
    expect(ticketResponsibleLabel(waiting, { fleet })).toBe("טויוטה · טרם נלקח ע״י טכנאי");
    expect(ticketResponsibleLabel(accepted, { fleet })).toBe("טויוטה · Igor");
    expect(ticketHolderLabel(accepted, "tech", { fleet })).toBe("טויוטה · Igor");
  });

  it("treats opener or supplier names on a new transport ticket as not yet accepted", () => {
    const openerAssigned = {
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      assignee: "Vadim",
      createdBy: { name: "Vadim", role: "user" }
    };
    const supplierAssigned = {
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      assignee: "טויוטה"
    };

    expect(ticketResponsibleLabel(openerAssigned, { fleet })).toBe("טויוטה · טרם נלקח ע״י טכנאי");
    expect(ticketResponsibleLabel(supplierAssigned, { fleet })).toBe("טויוטה · טרם נלקח ע״י טכנאי");
  });

  it("names the requester when manager approval is the current holder", () => {
    expect(ticketHolderLabel({
      status: "pending_user",
      createdBy: { name: "Vadim" }
    }, "manager")).toBe("Vadim · לאישור ביצוע");
  });
});
