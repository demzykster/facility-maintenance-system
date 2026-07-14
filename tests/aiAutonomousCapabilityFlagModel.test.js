import { describe, expect, it } from "vitest";
import { autonomousTicketCreateEnabled } from "../src/aiAutonomousCapabilityFlagModel.js";

describe("AI autonomous ticket create feature flag", () => {
  it("is off by default and enables only for the requested environment scope", () => {
    expect(autonomousTicketCreateEnabled({})).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "false" })).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local", CMMS_APP_MODE: "production" })).toBe(false);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "local", CMMS_APP_MODE: "local" })).toBe(true);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "staging", CMMS_APP_MODE: "staging" })).toBe(true);
    expect(autonomousTicketCreateEnabled({ CMMS_AI_AUTONOMOUS_TICKET_CREATE: "production", CMMS_APP_MODE: "production" })).toBe(true);
  });
});
