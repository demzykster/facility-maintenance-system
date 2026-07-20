import { describe, expect, it } from "vitest";

import {
  buildTicketWaitingTargetPatch,
  getTicketWaitingTargetState,
  readTicketWaitingTarget,
  ticketWaitingTargetDraft,
  validateTicketWaitingTargetDraft,
  waitingTargetRequirementForReason
} from "../src/ticketWaitingTargetModel.js";

describe("ticket waiting target model", () => {
  it("defines the target required by each target-bearing waiting reason", () => {
    expect(waitingTargetRequirementForReason("supplier")).toEqual({ required: true, type: "supplier" });
    expect(waitingTargetRequirementForReason("requester_confirmation")).toEqual({ required: true, type: "user" });
    expect(waitingTargetRequirementForReason("manager_decision")).toEqual({ required: true, type: "manager" });
    expect(waitingTargetRequirementForReason("scheduled_date")).toEqual({ required: true, type: "date" });
    expect(waitingTargetRequirementForReason("parts")).toEqual({ required: false, type: "none" });
  });

  it("does not treat the execution supplier as a waiting supplier", () => {
    expect(getTicketWaitingTargetState({
      status: "waiting",
      waitingReason: "supplier",
      supplier: "Execution Co"
    })).toEqual({
      required: true,
      requiredType: "supplier",
      satisfied: false,
      target: {
        type: "none",
        complete: false,
        sourceField: "none",
        supplier: "",
        user: null,
        until: null
      }
    });
  });

  it("reads an explicit waiting supplier independently from routing", () => {
    expect(readTicketWaitingTarget({
      supplier: "Execution Co",
      waitingTargetType: "supplier",
      waitingSupplier: "Quote Co"
    })).toEqual({
      type: "supplier",
      complete: true,
      sourceField: "waitingSupplier",
      supplier: "Quote Co",
      user: null,
      until: null
    });
  });

  it("reads explicit user and manager targets without changing the assignee", () => {
    expect(readTicketWaitingTarget({
      assignee: "Technician",
      waitingTargetType: "user",
      waitingUser: { id: "requester-1", name: "Requester" }
    })).toMatchObject({
      type: "user",
      complete: true,
      user: { id: "requester-1", name: "Requester" }
    });
    expect(readTicketWaitingTarget({
      assignee: "Technician",
      waitingTargetType: "manager",
      waitingUser: { id: "manager-1", name: "Manager" }
    })).toMatchObject({
      type: "manager",
      complete: true,
      user: { id: "manager-1", name: "Manager" }
    });
  });

  it("normalizes an explicit scheduled date target", () => {
    const waitingUntil = "2026-07-25T09:00:00.000Z";
    expect(readTicketWaitingTarget({
      waitingTargetType: "date",
      waitingUntil
    })).toEqual({
      type: "date",
      complete: true,
      sourceField: "waitingUntil",
      supplier: "",
      user: null,
      until: Date.parse(waitingUntil)
    });
  });

  it("builds an explicit waiting supplier patch without copying the execution supplier", () => {
    expect(buildTicketWaitingTargetPatch("supplier", {
      waitingSupplier: "Quote Co"
    })).toEqual({
      waitingTargetType: "supplier",
      waitingSupplier: "Quote Co",
      waitingUser: null,
      waitingUntil: null
    });
  });

  it("builds user, manager, and date targets while clearing unrelated target fields", () => {
    expect(buildTicketWaitingTargetPatch("requester_confirmation", {
      waitingUser: { id: "requester-1", name: "Requester" }
    })).toEqual({
      waitingTargetType: "user",
      waitingSupplier: null,
      waitingUser: { id: "requester-1", name: "Requester" },
      waitingUntil: null
    });
    expect(buildTicketWaitingTargetPatch("manager_decision", {
      waitingUser: { id: "manager-1", name: "Manager" }
    })).toMatchObject({
      waitingTargetType: "manager",
      waitingUser: { id: "manager-1", name: "Manager" }
    });
    expect(buildTicketWaitingTargetPatch("scheduled_date", {
      waitingUntil: "2026-07-25T09:00"
    })).toMatchObject({
      waitingTargetType: "date",
      waitingSupplier: null,
      waitingUser: null,
      waitingUntil: Date.parse("2026-07-25T09:00")
    });
  });

  it("requires only the target that belongs to the selected waiting reason", () => {
    expect(validateTicketWaitingTargetDraft("supplier", {})).toEqual({ valid: false, requiredType: "supplier" });
    expect(validateTicketWaitingTargetDraft("supplier", { waitingSupplier: "Quote Co" })).toEqual({ valid: true, requiredType: "supplier" });
    expect(validateTicketWaitingTargetDraft("parts", {})).toEqual({ valid: true, requiredType: "none" });
  });

  it("creates an editable draft from optional persisted target fields", () => {
    expect(ticketWaitingTargetDraft({
      waitingTargetType: "manager",
      waitingUser: { id: "manager-1", name: "Manager" }
    })).toEqual({
      waitingSupplier: "",
      waitingUser: { id: "manager-1", name: "Manager" },
      waitingUntil: ""
    });
  });
});
