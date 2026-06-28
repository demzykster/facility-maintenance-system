import { describe, expect, it } from "vitest";
import { STAGING_SMOKE_REQUIRED_ENV } from "../src/stagingSmokePreflightModel.js";

describe("staging smoke preflight model", () => {
  it("requires both browser-visible and server-side Supabase env", () => {
    expect(STAGING_SMOKE_REQUIRED_ENV).toEqual(expect.arrayContaining([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    ]));
  });
});
