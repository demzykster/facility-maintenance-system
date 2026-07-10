import { describe, expect, it } from "vitest";
import { STARTUP_KV_PREFIXES, startupKvPrefixesForAuthorities } from "../src/startupDataLoadModel.js";

describe("startup data load model", () => {
  it("loads every legacy KV prefix when no normalized authorities are active", () => {
    expect(startupKvPrefixesForAuthorities({})).toEqual(Object.values(STARTUP_KV_PREFIXES));
  });

  it("skips the legacy ticket, fleet, PM, and user prefixes once their APIs are authoritative", () => {
    expect(startupKvPrefixesForAuthorities({
      tickets: true,
      fleet: true,
      pm: true,
      users: true
    })).not.toEqual(expect.arrayContaining([
      "ticket:",
      "fleet:",
      "pm:",
      "user:"
    ]));
  });

  it("skips grouped legacy prefixes for grouped normalized authorities", () => {
    expect(startupKvPrefixesForAuthorities({
      ppe: true,
      work: true,
      settingsRecords: true
    })).not.toEqual(expect.arrayContaining([
      "ppe:",
      "ppeitem:",
      "ppenorm:",
      "ppereq:",
      "ppeorder:",
      "mtask:",
      "mmeet:",
      "location:",
      "appIssue:"
    ]));
  });

  it("returns no legacy KV prefixes when every production API authority is active", () => {
    expect(startupKvPrefixesForAuthorities({
      tickets: true,
      pm: true,
      fleet: true,
      presence: true,
      users: true,
      cleaningZones: true,
      cleaningRounds: true,
      cleaningComplaints: true,
      workerAbsences: true,
      settingsRecords: true,
      work: true,
      ppe: true
    })).toEqual([]);
  });
});
