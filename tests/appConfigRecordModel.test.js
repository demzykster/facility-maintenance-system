import { describe, expect, it } from "vitest";
import {
  APP_CONFIG_ID,
  APP_CONFIG_KEY,
  appConfigRecordFromSupabaseRow,
  appConfigRecordToSupabaseRow,
  normalizeAppConfigRecord,
  parseStoredAppConfigValue,
  serializeAppConfigValue
} from "../src/appConfigRecordModel.js";

describe("app config record model", () => {
  it("normalizes app config records for Supabase rows", () => {
    const row = appConfigRecordToSupabaseRow({ departments: ["Ops"], catSla: { electric: { high: 1 } } });

    expect(row).toEqual({
      id: APP_CONFIG_ID,
      config: { departments: ["Ops"], catSla: { electric: { high: 1 } } },
      source_kv_key: APP_CONFIG_KEY,
      legacy_payload: { departments: ["Ops"], catSla: { electric: { high: 1 } } }
    });
  });

  it("restores app config records from Supabase rows", () => {
    const config = { companyName: "CDSL", departments: ["Ops"] };

    expect(appConfigRecordFromSupabaseRow({
      id: APP_CONFIG_ID,
      config,
      source_kv_key: APP_CONFIG_KEY
    })).toEqual({
      id: APP_CONFIG_ID,
      config,
      sourceKvKey: APP_CONFIG_KEY,
      legacyPayload: config
    });
  });

  it("accepts serialized legacy config values", () => {
    expect(normalizeAppConfigRecord("{\"companyName\":\"CDSL\"}").config).toEqual({ companyName: "CDSL" });
    expect(serializeAppConfigValue({ companyName: "CDSL" })).toBe("{\"companyName\":\"CDSL\"}");
  });

  it("extracts config from the settings API envelope used by storage reads", () => {
    expect(parseStoredAppConfigValue({
      ok: true,
      source: "normalized",
      value: "{\"companyName\":\"Old\"}",
      config: { companyName: "New", siteName: "North site" }
    })).toEqual({ companyName: "New", siteName: "North site" });
  });
});
