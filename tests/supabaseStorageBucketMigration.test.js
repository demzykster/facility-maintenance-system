import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260628134000_cmms_files_bucket.sql", import.meta.url),
  "utf8"
);

describe("Supabase storage bucket migration", () => {
  it("creates the private cmms-files bucket used by production file storage", () => {
    expect(migrationSql).toContain("insert into storage.buckets");
    expect(migrationSql).toContain("'cmms-files'");
    expect(migrationSql).toContain("public = false");
    expect(migrationSql).toContain("file_size_limit");
  });
});
