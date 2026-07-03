import { describe, expect, it } from "vitest";
import { applyEnvValues, parseEnvFile } from "../src/envFileModel.js";

describe("envFileModel", () => {
  it("parses simple dotenv files without leaking comments into values", () => {
    expect(parseEnvFile(`
# comment
VITE_CMMS_APP_MODE=production
SUPABASE_URL="https://supabase.example"
SUPABASE_ANON_KEY='anon'
EMPTY=
BROKEN_LINE
    `)).toEqual({
      VITE_CMMS_APP_MODE: "production",
      SUPABASE_URL: "https://supabase.example",
      SUPABASE_ANON_KEY: "anon",
      EMPTY: ""
    });
  });

  it("applies local env values as the explicit source for that preflight run", () => {
    expect(applyEnvValues({ SUPABASE_URL: "https://old.example" }, {
      SUPABASE_URL: "https://new.example",
      VITE_SUPABASE_URL: "https://new.example"
    })).toEqual({
      SUPABASE_URL: "https://new.example",
      VITE_SUPABASE_URL: "https://new.example"
    });
  });
});
