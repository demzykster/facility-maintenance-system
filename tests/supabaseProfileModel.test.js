import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DATA_COLLECTIONS } from "../src/dataCollections.js";
import { PERM_LEVELS, USER_PERMISSION_MODULES } from "../src/permissionModel.js";
import {
  SUPABASE_APP_USER_ROLES,
  SUPABASE_APP_USER_TABLE,
  SUPABASE_PERMISSION_LEVEL_RANK,
  SUPABASE_PERMISSION_MODULE_KEYS,
  normalizeSupabaseAppUserProfile,
  supabasePermissionRank
} from "../src/supabaseProfileModel.js";

const migrationSql = readFileSync(
  new URL("../supabase/migrations/20260627173000_app_users_permissions.sql", import.meta.url),
  "utf8"
);

describe("supabase profile foundation", () => {
  it("maps the current user collection to the app profile table, not auth.users", () => {
    expect(DATA_COLLECTIONS.find((collection) => collection.key === "users")).toMatchObject({
      prefix: "user:",
      table: SUPABASE_APP_USER_TABLE
    });
    expect(SUPABASE_APP_USER_TABLE).toBe("app_users");
  });

  it("keeps permission level ranks aligned with the frontend permission model", () => {
    expect(Object.keys(SUPABASE_PERMISSION_LEVEL_RANK)).toEqual(PERM_LEVELS);
    expect(supabasePermissionRank("none")).toBe(0);
    expect(supabasePermissionRank("full")).toBe(4);
    expect(supabasePermissionRank("unknown")).toBe(0);
  });

  it("keeps permission module keys aligned with the frontend permission editor", () => {
    expect(SUPABASE_PERMISSION_MODULE_KEYS).toEqual(USER_PERMISSION_MODULES.map((module) => module.mod));
    expect(SUPABASE_PERMISSION_MODULE_KEYS).toContain("users");
    expect(SUPABASE_PERMISSION_MODULE_KEYS).toContain("workerAccess");
    expect(SUPABASE_PERMISSION_MODULE_KEYS).toContain("controls");
  });

  it("normalizes app user profiles for the future Supabase auth adapter", () => {
    expect(normalizeSupabaseAppUserProfile({
      auth_user_id: "auth-1",
      id: "app-user-1",
      role: "admin",
      name: " Owner ",
      email: "OWNER@Example.COM",
      dept: "הנהלה",
      manager_zones: ["z1"],
      tech_scope: "both",
      supplier: "ספק א",
      perms: { users: "manage" },
      must_change_password: true
    })).toEqual({
      authUserId: "auth-1",
      id: "app-user-1",
      role: "admin",
      name: "Owner",
      email: "owner@example.com",
      phone: "",
      workerNo: null,
      department: "הנהלה",
      departments: [],
      mgrZones: ["z1"],
      techScope: "both",
      supplier: "ספק א",
      permissions: { users: "manage" },
      active: true,
      mustChangePassword: true
    });
  });

  it("defines the initial Supabase RLS contract for app users", () => {
    expect(migrationSql).toContain("create table if not exists public.app_users");
    expect(migrationSql).toContain("references auth.users(id)");
    expect(migrationSql).toContain("alter table public.app_users enable row level security");
    expect(migrationSql).toContain("create policy app_users_select_self");
    expect(migrationSql).toContain("create policy app_users_admin_all");
    expect(migrationSql).toContain("create or replace function public.cmms_has_permission");
    expect(migrationSql).not.toContain("for update");
    for (const role of SUPABASE_APP_USER_ROLES) expect(migrationSql).toContain(`'${role}'`);
  });
});
