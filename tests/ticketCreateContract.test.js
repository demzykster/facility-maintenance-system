import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSPORT_DOWNTIME_LEVELS,
  SYSTEM_DOWNTIME_NEEDS_TRIAGE,
  downtimeLevelOf,
  downtimeLevelsWithSystemDefaults,
  isDowntimeNeedsTriage,
  isDowntimeOutOfService,
  missingTicketCreateFields,
  ticketCreateContractSummary,
  transportCreateDowntimeLevels,
  transportDowntimeTypeFromText,
  transportPriorityForDowntimeType
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

  it("uses only configured transport downtime levels for create choices", () => {
    const config = {
      downtimeLevels: [
        SYSTEM_DOWNTIME_NEEDS_TRIAGE,
        { id: "check", label: "תקלה לטיפול או בדיקה", desc: "ניתן להמשיך לעבוד", prio: "low", color: "#16A34A" },
        { id: "critical", label: "תקלה קריטית - אין גיבוי", desc: "הכלי מושבת ואין גיבוי", prio: "high", color: "#DC2626", oos: true }
      ]
    };

    expect(transportCreateDowntimeLevels(config).map((level) => level.id)).toEqual(["check", "critical"]);
    expect(ticketCreateContractSummary(config).downtimeLevels.map((level) => level.id)).toEqual(["check", "critical"]);
    expect(ticketCreateContractSummary(config).systemDowntimeLevels).toEqual([SYSTEM_DOWNTIME_NEEDS_TRIAGE]);
    expect(transportPriorityForDowntimeType("critical", config)).toBe("high");
    expect(transportDowntimeTypeFromText("הכלי מושבת ואין גיבוי", config)).toBe("critical");
    expect(transportCreateDowntimeLevels({}, DEFAULT_TRANSPORT_DOWNTIME_LEVELS).map((level) => level.id)).not.toContain("needs_triage");
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
