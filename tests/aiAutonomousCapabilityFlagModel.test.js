import { describe, expect, it } from "vitest";
import {
  AI_AUTONOMOUS_TICKET_CREATE_PERMISSION,
  aiAutonomousTicketCreateAccessStatus,
  aiAutonomousTicketCreatePermitted,
  autonomousTicketCreateEnabled
} from "../src/aiAutonomousCapabilityFlagModel.js";

describe("AI autonomous ticket create feature flag", () => {
  it("is off by default and enables only for the requested environment scope", () => {
    expect(autonomousTicketCreateEnabled({})).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "false" })).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local", CMMS_APP_MODE: "production" })).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local", CMMS_APP_MODE: "local" })).toBe(true);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "staging", CMMS_APP_MODE: "staging" })).toBe(true);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "production", CMMS_APP_MODE: "production" })).toBe(true);
  });

  it("requires explicit per-user request permission and a management role", () => {
    const permission = { [AI_AUTONOMOUS_TICKET_CREATE_PERMISSION]: "request" };

    expect(aiAutonomousTicketCreatePermitted({ role: "admin", permissions: {} })).toBe(false);
    expect(aiAutonomousTicketCreatePermitted({ role: "executive", permissions: permission })).toBe(true);
    expect(aiAutonomousTicketCreatePermitted({ role: "user", permissions: permission })).toBe(true);
    expect(aiAutonomousTicketCreatePermitted({ role: "user", permissions: { [AI_AUTONOMOUS_TICKET_CREATE_PERMISSION]: "manage" } })).toBe(false);
    expect(aiAutonomousTicketCreatePermitted({ role: "worker", permissions: permission })).toBe(false);
    expect(aiAutonomousTicketCreatePermitted({ role: "tech", permissions: permission })).toBe(false);
    expect(aiAutonomousTicketCreatePermitted({ role: "user", active: false, permissions: permission })).toBe(false);
  });

  it("reports effective access only when global flag and explicit permission are both present", () => {
    const permission = { [AI_AUTONOMOUS_TICKET_CREATE_PERMISSION]: "request" };

    expect(aiAutonomousTicketCreateAccessStatus({
      CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local",
      CMMS_APP_MODE: "local"
    }, { role: "user", permissions: permission })).toMatchObject({
      globalEnabled: true,
      permissionLevel: "request",
      permitted: true,
      effectiveAccess: true
    });

    expect(aiAutonomousTicketCreateAccessStatus({}, { role: "user", permissions: permission })).toMatchObject({
      globalEnabled: false,
      permissionLevel: "request",
      permitted: true,
      effectiveAccess: false
    });
  });
});
