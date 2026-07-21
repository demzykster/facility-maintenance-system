import { describe, expect, it } from "vitest";
import { ticketNextResponsibilityKey } from "../src/ticketNextResponsibilityModel.js";

describe("ticket next responsibility semantic bridge", () => {
  it("keeps transport supplier queue in technician execution responsibility", () => {
    expect(ticketNextResponsibilityKey({
      track: "transport",
      status: "new",
      supplier: "Toyota",
      routedTech: true,
      assignee: ""
    })).toBe("tech");
  });

  it("does not turn facility contractor metadata into a transport-style queue", () => {
    expect(ticketNextResponsibilityKey({
      track: "facility",
      status: "new",
      supplier: "Contractor",
      routedTech: false,
      assignee: ""
    })).toBe("admin");
  });

  it("keeps supplier waiting on the current internal execution owner", () => {
    expect(ticketNextResponsibilityKey({
      track: "facility",
      status: "waiting",
      waitingReason: "supplier",
      waitingSupplier: "HVAC Vendor",
      assignee: "Vadim"
    })).toBe("tech");
  });

  it("routes manager and admin approval states to the correct owner", () => {
    expect(ticketNextResponsibilityKey({ status: "pending_user" })).toBe("manager");
    expect(ticketNextResponsibilityKey({ status: "pending_manager" })).toBe("manager");
    expect(ticketNextResponsibilityKey({ status: "pending_admin" })).toBe("admin");
  });

  it("keeps rework and closed tickets out of active responsibility buckets", () => {
    expect(ticketNextResponsibilityKey({ status: "rework", assignee: "Sharon" })).toBe("none");
    expect(ticketNextResponsibilityKey({ status: "done", assignee: "Sharon" })).toBe("none");
  });
});
