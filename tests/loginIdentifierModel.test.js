import { describe, expect, it } from "vitest";
import { resolveIdentifier } from "../src/loginIdentifierModel.js";

const users = [
  { id: "admin-1", role: "admin", email: "Vadim@example.local", password: "1234" },
  { id: "mgr-1", role: "user", email: "manager@local", password: "1234", active: false },
  { id: "mgr-2", role: "user", email: "old-manager@local", password: "1234", status: "archived" },
  { id: "worker-1", role: "worker", workerNo: "1042", pin: "1234" },
  { id: "cleaner-1", role: "cleaner", workerNo: "1050", pin: "1234" },
  { id: "tech-1", role: "tech", pin: "7788" }
];

const builtins = [
  { id: "builtin-admin", role: "admin", email: "demo@local", password: "1234" },
  { id: "builtin-tech", role: "tech", pin: "1234" }
];

describe("resolveIdentifier", () => {
  it("resolves staff email case-insensitively and asks for password", () => {
    expect(resolveIdentifier(" vadim@example.local ", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "email",
      auth: "password",
      source: "users",
      user: { id: "admin-1" }
    });
  });

  it("blocks archived users before authentication", () => {
    expect(resolveIdentifier("manager@local", users, builtins)).toMatchObject({
      status: "archived",
      identifierType: "email",
      auth: "password",
      user: { id: "mgr-1" }
    });
    expect(resolveIdentifier("old-manager@local", users, builtins)).toMatchObject({
      status: "archived",
      identifierType: "email",
      user: { id: "mgr-2" }
    });
  });

  it("resolves worker and cleaner numbers to PIN authentication", () => {
    expect(resolveIdentifier("1042", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "workerNo",
      auth: "pin",
      user: { id: "worker-1" }
    });
    expect(resolveIdentifier("1050", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "workerNo",
      auth: "pin",
      user: { id: "cleaner-1" }
    });
  });

  it("resolves technician codes as the current no-second-secret demo flow", () => {
    expect(resolveIdentifier("7788", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "techCode",
      auth: "none",
      user: { id: "tech-1" }
    });
  });

  it("falls back to built-in demo identities after stored users", () => {
    expect(resolveIdentifier("demo@local", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "email",
      source: "builtin",
      user: { id: "builtin-admin" }
    });
    expect(resolveIdentifier("1234", users, builtins)).toMatchObject({
      status: "active",
      identifierType: "techCode",
      source: "builtin",
      user: { id: "builtin-tech" }
    });
  });

  it("distinguishes empty and unknown identifiers", () => {
    expect(resolveIdentifier("", users, builtins)).toMatchObject({ status: "empty", user: null });
    expect(resolveIdentifier("missing@local", users, builtins)).toMatchObject({ status: "not_found", user: null });
  });
});
