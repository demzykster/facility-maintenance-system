# Ogen Operations

This is the operational entry point for Ogen CMMS. It is for technical owners who need to verify, release, monitor, troubleshoot, or recover the live system without relying on oral history.

## What Ogen Is

Ogen is the live CMMS application for maintenance, fleet, PPE, suppliers, tasks, AI-assisted ticket intake, and operational dashboards. The current live system uses the Vercel project `facility-maintenance-system` and Supabase-backed application services.

## Current Production Shape

- Production URL: `https://facility-maintenance-system.vercel.app`
- Current production baseline at R12 start: `567a5f9571537c7afb82c88671aeac12aee8ca3c`
- Deployment platform: Vercel
- API model: Vercel Functions under `api/`, delegating to `server/` handlers
- Data/auth/storage/audit: Supabase-backed
- Package manager: npm
- CI: GitHub Actions workflow `.github/workflows/ci.yml`

Always re-check the current values before action:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
curl -fsS https://facility-maintenance-system.vercel.app/cmms-version.json
curl -fsS https://facility-maintenance-system.vercel.app/api/health
```

## Canonical Runbooks

- [Runbook index](runbook-index.md)
- [Production change policy](production-change-policy.md)
- [Business continuity guide](business-continuity-guide.md)
- [Access and dependency register](access-and-dependency-register.md)
- [Environment reference](environment-reference.md)
- [Documentation inventory](documentation-inventory.md)
- [First-run installation](first-run-installation.md)

Core existing runbooks:

- [Monitoring runbook](../monitoring-runbook.md)
- [Incident response runbook](../incident-response-runbook.md)
- [Rollback checklist](../rollback-checklist.md)
- [Recovery readiness R8](../recovery-readiness-r8.md)
- [Domain change runbook](../domain-change-runbook.md)
- [Domain change checklist](../domain-change-checklist.md)
- [Platform portability runbook](../platform-portability-runbook.md)
- [Platform portability checklist](../platform-portability-checklist.md)
- [Security reconciliation R11](../security-reconciliation-r11.md)
- [First-run install checklist](checklists/first-run-install.md)

## First Response Rules

For any incident:

1. Stop unrelated changes.
2. Capture production SHA from `/cmms-version.json`.
3. Capture health from `/api/health`.
4. Preserve evidence before changing anything.
5. Decide with the owner whether to monitor, forward-fix, rollback, or start recovery.
6. Change only one production system at a time.

For any production change:

1. Verify Git, origin, production SHA, and health.
2. Inspect the exact diff.
3. Run required checks.
4. Commit locally.
5. Get explicit owner approval before push or deployment.

## Never Do Without Explicit Owner Approval

- Push to `origin/main`.
- Deploy or redeploy production.
- Change Vercel aliases, project config, env, or DNS.
- Change Supabase schema, data, Auth, storage, or RLS.
- Run migrations against production.
- Restore over production.
- Delete production data, tickets, files, users, audit records, or evidence.
- Rotate secrets.
- Run authenticated live write-smoke.

## Source Order

Use this order when documents disagree:

1. Current checkout, Git, origin, production version, production health.
2. Current code, migrations, API handlers, tests, and CI workflows.
3. `docs/current-state.md`.
4. Canonical operations docs under `docs/operations/`.
5. Domain-specific runbooks and ADRs.
6. Historical handoffs, audits, archives, and old ledgers.

Historical docs are evidence. They are not current state unless re-verified.
