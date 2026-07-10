import { describe, expect, it } from "vitest";
import {
  baseLocationFromCleaningZone,
  cleaningProfileFromZone,
  legacyZoneLocationId,
  locationDisplayText,
  locationFromLegacyZoneName,
  locationRecordFromSupabaseRow,
  locationRecordToSupabaseRow,
  locationsFromLegacyZoneNames,
  normalizeLocationRecord,
  normalizeLocationType
} from "../src/locationModel.js";

describe("location model", () => {
  it("normalizes legacy string zones into stable base location drafts", () => {
    expect(locationFromLegacyZoneName(" מחסן ראשי ")).toEqual({
      id: legacyZoneLocationId("מחסן ראשי"),
      name: "מחסן ראשי",
      type: "general",
      building: "",
      floor: "",
      area: "",
      parentId: null,
      active: true,
      tags: ["legacy-zone"],
      source: { module: "maintenance", kind: "config.zones", value: "מחסן ראשי" }
    });
  });

  it("deduplicates legacy zone names without keeping empty rows", () => {
    expect(locationsFromLegacyZoneNames(["כללי", " ", "כללי", "חניון"]).map((location) => location.name)).toEqual([
      "כללי",
      "חניון"
    ]);
  });

  it("splits a cleaning zone into a base location without cleaning internals", () => {
    const base = baseLocationFromCleaningZone({
      id: "cz-1",
      name: "שירותים קומה 2",
      building: "A",
      floor: "2",
      windows: [{ time: "07:00" }],
      checklist: [{ id: "sink", label: "כיור" }],
      cleanerId: "u-cleaner"
    });

    expect(base).toEqual({
      id: "cz-1",
      name: "שירותים קומה 2",
      type: "general",
      building: "A",
      floor: "2",
      area: "",
      parentId: null,
      active: true,
      tags: ["cleaning"],
      source: { module: "cleaning", kind: "czone", id: "cz-1" }
    });
    expect(base).not.toHaveProperty("windows");
    expect(base).not.toHaveProperty("checklist");
    expect(base).not.toHaveProperty("cleanerId");
  });

  it("keeps cleaning-specific fields in a linked cleaning profile", () => {
    const profile = cleaningProfileFromZone({
      id: "cz-2",
      locationId: "loc-2",
      code: "Z123",
      name: "מטבחון",
      checklist: [{ id: "floor", label: "רצפה" }],
      windows: [{ id: "morning", time: "08:00", tol: 30 }],
      activeDays: [0, 1, 2, 3, 4],
      cleanerId: "u1",
      cleanerName: "Cleaner",
      compliancePolicy: { requirePhotoOnIssue: true }
    }, ["m1", "m1", "m2"]);

    expect(profile).toEqual({
      locationId: "loc-2",
      cleaningZoneId: "cz-2",
      checklist: [{ id: "floor", label: "רצפה" }],
      windows: [{ id: "morning", time: "08:00", tol: 30 }],
      activeDays: [0, 1, 2, 3, 4],
      cleanerId: "u1",
      cleanerName: "Cleaner",
      managerIds: ["m1", "m2"],
      qrCode: "Z123",
      compliancePolicy: { requirePhotoOnIssue: true }
    });
  });

  it("formats display text from base location fields", () => {
    expect(locationDisplayText({
      name: "רציפי טעינה",
      building: "B",
      floor: "",
      area: "מערב"
    })).toBe("רציפי טעינה · B · מערב");
  });

  it("falls back unknown types to general", () => {
    expect(normalizeLocationType("warehouse")).toBe("warehouse");
    expect(normalizeLocationType("cleaning-only")).toBe("general");
  });

  it("maps locations to and from normalized Supabase rows", () => {
    const row = locationRecordToSupabaseRow({ id: "loc-1", name: "מחסן", type: "warehouse", tags: ["main"] });

    expect(row).toMatchObject({
      id: "loc-1",
      name: "מחסן",
      type: "warehouse",
      source_kv_key: "location:loc-1"
    });
    expect(locationRecordFromSupabaseRow({ ...row, legacy_payload: { id: "loc-1", name: "Legacy" } })).toEqual({
      id: "loc-1",
      name: "Legacy"
    });
    expect(normalizeLocationRecord({ id: "loc-2", name: "חצר" })).toMatchObject({
      id: "loc-2",
      sourceKvKey: "location:loc-2"
    });
  });
});
