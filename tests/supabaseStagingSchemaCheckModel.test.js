import { describe, expect, it } from "vitest";
import {
  missingSupabaseSchemaEnv,
  normalizeSupabaseUrl,
  requiredSupabaseSchemaEnv,
  supabaseSchemaCheckSummary
} from "../src/supabaseStagingSchemaCheckModel.js";

describe("supabase staging schema check model", () => {
  it("requires only the env needed for schema and bucket checks", () => {
    expect(requiredSupabaseSchemaEnv()).toEqual([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CMMS_FILE_BUCKET"
    ]);
    expect(missingSupabaseSchemaEnv({ SUPABASE_URL: "x" })).toEqual([
      "SUPABASE_SERVICE_ROLE_KEY",
      "CMMS_FILE_BUCKET"
    ]);
  });

  it("normalizes Supabase project URLs", () => {
    expect(normalizeSupabaseUrl(" https://example.supabase.co/// ")).toBe("https://example.supabase.co");
  });

  it("summarizes table and private bucket status without secret values", () => {
    const summary = supabaseSchemaCheckSummary({
      tables: [{ name: "app_users", ok: true, status: 200 }],
      bucket: { name: "cmms-files", ok: true, private: true, status: 200 },
      errors: []
    });

    expect(summary).toEqual({
      ok: true,
      tables: [{ name: "app_users", ok: true, status: 200 }],
      bucket: { name: "cmms-files", ok: true, private: true, status: 200 },
      errors: []
    });
  });
});
