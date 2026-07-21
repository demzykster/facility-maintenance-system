import { describe, expect, it } from "vitest";
import {
  SYSTEM_DOWNTIME_NEEDS_TRIAGE,
  downtimeLevelOf,
  downtimeLevelsWithSystemDefaults,
  isDowntimeNeedsTriage,
  isDowntimeOutOfService,
  missingTicketCreateFields,
  ticketCreateContractSummary
} from "../src/ticketCreateContract.js";

describe("ticket create contract", () => {
  it("adds needs_triage as a neutral system downtime option without proving oos false", () => {
    expect(SYSTEM_DOWNTIME_NEEDS_TRIAGE).toMatchObject({
      id: "needs_triage",
      prio: "medium",
      color: "#64748B",
      requiresTriage: true
    });
    expect(SYSTEM_DOWNTIME_NEEDS_TRIAGE).not.toHaveProperty("oos");
    expect(isDowntimeOutOfService(SYSTEM_DOWNTIME_NEEDS_TRIAGE)).toBe(false);
    expect(isDowntimeNeedsTriage(SYSTEM_DOWNTIME_NEEDS_TRIAGE)).toBe(true);
  });

  it("keeps oos checks strict and preserves admin configured downtime levels", () => {
    const levels = downtimeLevelsWithSystemDefaults({
      downtimeLevels: [
        { id: "critical", label: "Critical", prio: "high", oos: true },
        { id: "minor", label: "Minor", prio: "low", oos: false }
      ]
    });

    expect(levels.map((level) => level.id)).toEqual(["needs_triage", "critical", "minor"]);
    expect(levels[0].color).toBe("#64748B");
    expect(isDowntimeOutOfService(downtimeLevelOf("critical", { downtimeLevels: levels }))).toBe(true);
    expect(isDowntimeOutOfService(downtimeLevelOf("minor", { downtimeLevels: levels }))).toBe(false);
  });

  it("requires an explicit priority for every ordinary create", () => {
    expect(missingTicketCreateFields({
      track: "transport",
      subject: "Не работает вентилятор",
      description: "Не работает вентилятор на машине 226",
      forkliftId: "forklift-226",
      downtimeType: "needs_triage",
      priority: "medium"
    })).toEqual([]);
    expect(missingTicketCreateFields({
      track: "facility",
      subject: "Air conditioner",
      description: "Not cooling",
      category: "hvac"
    })).toContain("priority");
    expect(ticketCreateContractSummary().fields.priority).toContain("required_blocking");
    expect(ticketCreateContractSummary().fields.location).toBeUndefined();
    expect(ticketCreateContractSummary().fields.num).toEqual(["derived", "not_user_askable"]);
  });
});
