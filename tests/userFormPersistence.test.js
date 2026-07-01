import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../src/ClaudeMaintenanceApp.jsx", import.meta.url), "utf8");

describe("user form persistence", () => {
  it("keeps the Supabase auth link when saving an edited user", () => {
    const start = source.indexOf("function UserForm(");
    const end = source.indexOf("const ActivationControls", start);
    const userFormSource = source.slice(start, end);

    expect(userFormSource).toContain('authUserId: user.authUserId || ""');
  });

  it("blocks edited Supabase users from being saved when app_users sync fails", () => {
    const start = source.indexOf("const saveUser = async (u) =>");
    const end = source.indexOf("const delUser = async", start);
    const saveUserSource = source.slice(start, end);

    expect(saveUserSource).toContain("await syncAdminProfileUser(u)");
    expect(saveUserSource).toContain('console.warn("admin profile sync failed", error)');
    expect(saveUserSource.indexOf("await syncAdminProfileUser(u)")).toBeLessThan(saveUserSource.indexOf("persistShared(`user:${u.id}`"));
    expect(saveUserSource).not.toContain("syncAdminProfileUser(u).catch");
  });

  it("shows the user form save error when the parent save returns false", () => {
    const start = source.indexOf("function UserForm(");
    const end = source.indexOf("const ActivationControls", start);
    const userFormSource = source.slice(start, end);

    expect(userFormSource).toContain("const save = async () =>");
    expect(userFormSource).toContain("const ok = await onSave(");
    expect(userFormSource).toContain("if (ok === false) setErr(SAVE_FAILED_MESSAGE)");
  });
});
