---
name: cmms-runtime-issue-triage
description: Use for CMMS production, staging, browser, Vercel, Supabase, console, API, or runtime error triage. Required before fixing runtime issues when errors need grouping by signature, frequency, first/last occurrence, affected route/module, browser/device, severity, active/stale/noise status, reproduction, and regression proof.
---

# CMMS Runtime Issue Triage

Follow the repository root `AGENTS.md` before using this skill. Use with `systematic-debugging`; add `playwright-ui-regression-audit` for browser/UI symptoms.

## Triage Flow

1. Gather only approved/read-only evidence: logs, screenshots, error text, affected route, user role, browser/device, timestamp, deployment commit.
2. Group by normalized signature, not by individual stack trace instance.
3. Estimate frequency, first seen, last seen, active/stale/noise, and user impact.
4. Map each group to route/module/API/database boundary.
5. Reproduce locally or in approved environment when possible.
6. Do not fix the first stack trace you see before checking repeatability, current relevance, and whether it is active rather than old noise.
7. Do not run write probes against remote environments without approval.
8. Identify root cause before patching.
9. Add or update a regression test/check when feasible.
10. Close only with evidence that the grouped issue is no longer active or is intentionally accepted.

## Do Not Use For

- One-off compile/test failures that are fully local and already covered by `systematic-debugging`.
- Live/staging write probes without owner approval.
