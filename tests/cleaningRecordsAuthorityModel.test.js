import { describe, expect, it } from "vitest";
import { cleaningComplaintsAuthorityFailureIssue, cleaningComplaintsForAuthority, normalizedCleaningRecordsAuthorityEnabled, workerAbsencesAuthorityFailureIssue, workerAbsencesForAuthority } from "../src/cleaningRecordsAuthorityModel.js";

describe("cleaning records authority model", () => {
  it("enables normalized authority only in production API storage with a provider", () => {
    expect(normalizedCleaningRecordsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: {} })).toBe(true);
    expect(normalizedCleaningRecordsAuthorityEnabled({ appMode: "demo", storageProvider: "api", provider: {} })).toBe(false);
    expect(normalizedCleaningRecordsAuthorityEnabled({ appMode: "production", storageProvider: "local", provider: {} })).toBe(false);
    expect(normalizedCleaningRecordsAuthorityEnabled({ appMode: "production", storageProvider: "api", provider: null })).toBe(false);
  });

  it("loads complaints and absences from normalized providers when authority is enabled", async () => {
    await expect(cleaningComplaintsForAuthority({
      kvComplaints: [{ id: "kv-complaint" }],
      provider: { list: () => Promise.resolve({ complaints: [{ id: "complaint-1" }] }) },
      normalizedAuthority: true
    })).resolves.toEqual({ complaints: [{ id: "complaint-1" }], source: "normalized" });

    await expect(workerAbsencesForAuthority({
      kvAbsences: [{ id: "kv-absence" }],
      provider: { list: () => Promise.resolve({ absences: [{ id: "absence-1" }] }) },
      normalizedAuthority: true
    })).resolves.toEqual({ absences: [{ id: "absence-1" }], source: "normalized" });
  });

  it("keeps KV records outside normalized authority mode", async () => {
    await expect(cleaningComplaintsForAuthority({
      kvComplaints: [{ id: "kv-complaint" }],
      provider: { list: () => Promise.resolve({ complaints: [{ id: "complaint-1" }] }) },
      normalizedAuthority: false
    })).resolves.toEqual({ complaints: [{ id: "kv-complaint" }], source: "kv" });

    await expect(workerAbsencesForAuthority({
      kvAbsences: [{ id: "kv-absence" }],
      provider: { list: () => Promise.resolve({ absences: [{ id: "absence-1" }] }) },
      normalizedAuthority: false
    })).resolves.toEqual({ absences: [{ id: "kv-absence" }], source: "kv" });
  });

  it("creates consistent automatic issue payloads for normalized failures", () => {
    expect(cleaningComplaintsAuthorityFailureIssue({ action: "save", id: "complaint-1", message: "nope" })).toEqual({
      kind: "cleaning_complaints_normalized_save_failed",
      action: "save",
      key: "ccomplaint:complaint-1",
      message: "nope"
    });
    expect(workerAbsencesAuthorityFailureIssue({ action: "delete", id: "absence-1", message: "nope" })).toEqual({
      kind: "worker_absences_normalized_delete_failed",
      action: "delete",
      key: "cabsence:absence-1",
      message: "nope"
    });
  });
});
