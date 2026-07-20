import { describe, expect, it } from "vitest";
import {
  getTicketAssignedSupplier,
  getTicketExecutionContext,
  getTicketResponsibleUser,
  getTicketWaitingContext
} from "../src/ticketResponsibilitySemanticModel.js";

describe("ticket responsibility semantic model", () => {
  const fleet = [{ id: "fork-1", supplier: "LiftCo" }];

  it("describes a transport supplier queue before technician acceptance", () => {
    const ticket = {
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      assignee: "",
      routedTech: true
    };

    expect(getTicketAssignedSupplier(ticket, { fleet })).toMatchObject({
      name: "LiftCo",
      source: "fleet",
      isWaitingTarget: false
    });
    expect(getTicketResponsibleUser(ticket, { fleet })).toMatchObject({
      name: "",
      source: "none"
    });
    expect(getTicketExecutionContext(ticket, { fleet })).toMatchObject({
      track: "transport",
      mode: "supplier_queue",
      supplier: "LiftCo",
      technician: "",
      routedTech: true
    });
  });

  it("describes a transport technician after acceptance", () => {
    const ticket = {
      track: "transport",
      status: "in_progress",
      forkliftId: "fork-1",
      assignee: "Igor",
      routedTech: true
    };

    expect(getTicketResponsibleUser(ticket, { fleet })).toMatchObject({
      name: "Igor",
      source: "assignee"
    });
    expect(getTicketExecutionContext(ticket, { fleet })).toMatchObject({
      mode: "technician",
      supplier: "LiftCo",
      technician: "Igor"
    });
  });

  it("keeps facility assignee and assigned supplier as separate meanings", () => {
    const internalTicket = {
      track: "facility",
      status: "in_progress",
      assignee: "Vadim",
      supplier: ""
    };
    const supplierTicket = {
      track: "facility",
      status: "waiting",
      waitingReason: "supplier",
      waitBall: "executor",
      assignee: "",
      supplier: "HVAC Co",
      routedTech: true
    };

    expect(getTicketResponsibleUser(internalTicket)).toMatchObject({
      name: "Vadim",
      source: "assignee"
    });
    expect(getTicketAssignedSupplier(supplierTicket)).toMatchObject({
      name: "HVAC Co",
      source: "ticket",
      isWaitingTarget: false
    });
    expect(getTicketWaitingContext(supplierTicket)).toMatchObject({
      status: "waiting",
      reason: "supplier",
      actionOwner: "executor",
      hasExplicitTarget: false,
      target: null
    });
  });

  it("describes waiting reason and action owner without inventing target fields", () => {
    expect(getTicketWaitingContext({
      status: "waiting",
      waitingReason: "parts",
      waitBall: "executor"
    }, {
      waitReasonMeta: () => ({ pauseSla: true })
    })).toEqual({
      isWaiting: true,
      status: "waiting",
      reason: "parts",
      reasonSource: "waitingReason",
      actionOwner: "executor",
      pauseSla: true,
      hasExplicitTarget: false,
      targetType: "none",
      target: null
    });
  });

  it("keeps pending_user as requester approval rather than a generic waiting reason", () => {
    expect(getTicketWaitingContext({
      status: "pending_user",
      createdBy: { id: "mgr-1", name: "Vadim" }
    })).toMatchObject({
      isWaiting: true,
      status: "pending_user",
      reason: "requester_confirmation",
      reasonSource: "status",
      actionOwner: "requester",
      targetType: "requester",
      target: { id: "mgr-1", name: "Vadim" }
    });
  });

  it("reads AI-created transport tickets as the existing supplier queue shape", () => {
    const ticket = {
      track: "transport",
      status: "new",
      forkliftId: "fork-1",
      assignee: "",
      routedTech: true,
      supplier: "LiftCo",
      ai: { source: "ai_capability" }
    };

    expect(getTicketAssignedSupplier(ticket, { fleet })).toMatchObject({
      name: "LiftCo",
      isWaitingTarget: false
    });
    expect(getTicketExecutionContext(ticket, { fleet })).toMatchObject({
      mode: "supplier_queue",
      supplier: "LiftCo",
      technician: ""
    });
  });
});
