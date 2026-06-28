import { describe, expect, it } from "vitest";
import { STAGING_SMOKE_REQUIRED_ENV, stagingSupabaseEnvPairErrors } from "../src/stagingSmokePreflightModel.js";

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

  it("requires public and server Supabase env to point at the same project", () => {
    expect(stagingSupabaseEnvPairErrors({
      VITE_SUPABASE_URL: "https://supabase.example/",
      SUPABASE_URL: "https://supabase.example",
      VITE_SUPABASE_ANON_KEY: "anon",
      SUPABASE_ANON_KEY: "anon"
    })).toEqual([]);

    expect(stagingSupabaseEnvPairErrors({
      VITE_SUPABASE_URL: "https://public.example",
      SUPABASE_URL: "https://server.example",
      VITE_SUPABASE_ANON_KEY: "public-anon",
      SUPABASE_ANON_KEY: "server-anon"
    })).toEqual([
      "staging_smoke_requires_matching_public_and_server_supabase_url",
      "staging_smoke_requires_matching_public_and_server_supabase_anon_key"
    ]);
  });
});
