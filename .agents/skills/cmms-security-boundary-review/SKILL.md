---
name: cmms-security-boundary-review
description: Use for CMMS authentication, route authorization, object-level permissions, ID substitution, service-role boundaries, RLS, CSP, secrets, prompt injection, AI tool permissions, audit, mass/delete protection, or security-sensitive review. Required for AI write paths, Supabase/RPC work, auth/session work, and destructive actions.
---

# CMMS Security Boundary Review

Follow the repository root `AGENTS.md` before using this skill. Pair with `security-best-practices` or `security-threat-model` when the owner asks for a formal security review.

## Review Checklist

1. Identify actor, role, session source, route/API entrypoint, object IDs, and data authority.
2. Verify authorization server-side for production/API paths, not only in UI.
3. Check object-level permissions and ID substitution risks.
4. Check service-role use: allowed only behind server boundaries, never exposed to browser or AI provider.
5. Check RLS/RPC grants, CSP, secrets handling, audit events, and rate/abuse protections when relevant.
6. For AI tools/capabilities, verify permissions, risk class, prompt-injection handling, deterministic validation, idempotency, authoritative result, and no arbitrary SQL/service-role access.
7. For mass/delete/permission-expanding actions, require explicit owner/user confirmation and rollback/restore plan.

## Do Not Use For

- Pure visual changes with no auth, data, or execution boundary.
- Generic architecture commentary where no security-sensitive surface is touched.
