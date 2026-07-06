import { describe, expect, it } from "vitest";
import {
  cleaningQrAccess,
  cleaningQrMatchesZone,
  cleaningQrMatchesTarget,
  cleaningQrTarget,
  cleaningQrUrl,
  extractCzoneFromRaw,
  findCleaningQrTarget,
  findScannedCleaningZone,
  parseCleaningQrTarget,
  scannedCleaningZoneIdFromSearch
} from "../src/cleaningQrModel.js";

describe("cleaningQrModel", () => {
  it("builds an app URL that carries only the cleaning zone id", () => {
    const url = cleaningQrUrl({
      origin: "https://cmms.example",
      pathname: "/app",
      zoneId: "zone-1"
    });

    expect(url).toBe("https://cmms.example/app?z=czone%3Azone-1");
  });

  it("reads the scanned zone id from a QR URL", () => {
    expect(scannedCleaningZoneIdFromSearch("?z=czone:zone-2&x=1")).toBe("zone-2");
    expect(scannedCleaningZoneIdFromSearch("?czone=zone-2&x=1")).toBe("zone-2");
    expect(scannedCleaningZoneIdFromSearch("?x=1")).toBe("");
  });

  it("extracts a cleaning zone id from scanned QR text", () => {
    expect(extractCzoneFromRaw("https://cmms.example/?z=czone:zone-6")).toBe("zone-6");
    expect(extractCzoneFromRaw("https://cmms.example/?czone=zone-7&x=1")).toBe("zone-7");
    expect(extractCzoneFromRaw("?czone=zone-8")).toBe("zone-8");
    expect(extractCzoneFromRaw("czone=zone-9")).toBe("zone-9");
    expect(extractCzoneFromRaw("czone:zone-9b")).toBe("zone-9b");
    expect(extractCzoneFromRaw("QR code czone=zone-10")).toBe("zone-10");
    expect(extractCzoneFromRaw("plain text")).toBe("");
  });

  it("allows manual zone choice outside production", () => {
    expect(cleaningQrAccess({ appMode: "demo", zoneId: "z1" })).toEqual({
      allowed: true,
      reason: "manual_allowed"
    });
  });

  it("blocks production actions without a matching scanned QR zone", () => {
    expect(cleaningQrAccess({ appMode: "production", zoneId: "z1" })).toEqual({
      allowed: false,
      reason: "scan_required"
    });
    expect(cleaningQrAccess({ appMode: "production", zoneId: "z1", scannedZoneId: "z2" })).toEqual({
      allowed: false,
      reason: "wrong_zone"
    });
    expect(cleaningQrAccess({ appMode: "production", zoneId: "z1", scannedZoneId: "z1" })).toEqual({
      allowed: true,
      reason: "scan_matched"
    });
  });

  it("ignores inactive or unknown scanned zones", () => {
    const zones = [{ id: "a", active: true }, { id: "b", active: false }];
    expect(findScannedCleaningZone(zones, "a")).toEqual(zones[0]);
    expect(findScannedCleaningZone(zones, "b")).toBeNull();
    expect(findScannedCleaningZone(zones, "c")).toBeNull();
  });

  it("accepts the printed manual zone code as well as the QR payload id", () => {
    const zone = { id: "czone-123", code: "ZL7QK", active: true };
    expect(cleaningQrMatchesZone("https://cmms.example/?z=czone:czone-123", zone)).toBe(true);
    expect(cleaningQrMatchesZone("ZL7QK", zone)).toBe(true);
    expect(cleaningQrMatchesZone(" zl7qk ", zone)).toBe(true);
    expect(cleaningQrMatchesZone("ZL7QX", zone)).toBe(false);
    expect(cleaningQrMatchesZone("ZL7QK", { ...zone, active: false })).toBe(false);
  });

  it("builds and reads a second-level QR target for a cleaning subzone", () => {
    const target = cleaningQrTarget("zone-1", "wc-women");
    const url = cleaningQrUrl({
      origin: "https://cmms.example",
      pathname: "/app",
      zoneId: "zone-1",
      subzoneId: "wc-women"
    });

    expect(target).toBe("zone-1~wc-women");
    expect(url).toBe("https://cmms.example/app?z=czone%3Azone-1%7Ewc-women");
    expect(scannedCleaningZoneIdFromSearch("?z=czone:zone-1~wc-women")).toBe("zone-1~wc-women");
    expect(parseCleaningQrTarget("czone:zone-1~wc-women")).toEqual({ zoneId: "zone-1", subzoneId: "wc-women" });
  });

  it("finds a scanned cleaning zone and its subzone", () => {
    const zone = {
      id: "zone-1",
      active: true,
      subzones: [{ id: "wc-women", name: "שירותים נשים", code: "WC1" }]
    };

    expect(findCleaningQrTarget([zone], "zone-1~wc-women")).toEqual({ zone, subzone: { ...zone.subzones[0], active: true } });
    expect(cleaningQrMatchesZone("WC1", zone)).toBe(true);
    expect(cleaningQrMatchesZone("https://cmms.example/?z=czone:zone-1~wc-women", zone)).toBe(true);
    expect(findCleaningQrTarget([zone], "zone-1~missing")).toBeNull();
  });

  it("matches a specific subzone target without accepting sibling QR codes", () => {
    const zone = {
      id: "zone-1",
      active: true,
      subzones: [
        { id: "wc-women", name: "שירותים נשים", code: "WC1" },
        { id: "kitchen", name: "מטבחון", code: "KIT1" }
      ]
    };

    expect(cleaningQrMatchesTarget("czone:zone-1~wc-women", zone, zone.subzones[0])).toBe(true);
    expect(cleaningQrMatchesTarget("WC1", zone, zone.subzones[0])).toBe(true);
    expect(cleaningQrMatchesTarget("czone:zone-1~kitchen", zone, zone.subzones[0])).toBe(false);
    expect(cleaningQrMatchesTarget("KIT1", zone, zone.subzones[0])).toBe(false);
  });
});
