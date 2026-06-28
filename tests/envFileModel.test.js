import { describe, expect, it } from "vitest";
import { parseEnvFile } from "../src/envFileModel.js";

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
});
