# Operations Runbook Index

Last verified against local commit: `5983f23` with production/origin baseline `5983f23`.

This index maps canonical operational documentation. It is not an approval to execute production changes.

| Area | Purpose | When to use | Prerequisites | Action class | Owner approval | Canonical file |
|---|---|---|---|---|---|---|
| Daily operations | Routine read-only status check. | Daily or before starting operational work. | Production URL, GitHub access if checking CI. | Read-only | Not required for read-only checks. | [Daily health checklist](checklists/daily-health.md) |
| Deployment verification | Verify release readiness and post-deploy health. | Before and after any approved production push/deploy. | Clean tree, owner approval for push/deploy. | Read-only until push/deploy step. | Required for push/deploy. | [Release checklist](checklists/release.md) |
| Monitoring | Public health endpoint and manual monitor workflow. | Health check, uptime check, degraded state triage. | Explicit URL; no secrets. | Read-only | Not required for read-only checks. | [Monitoring runbook](../monitoring-runbook.md) |
| Incident response | Evidence, severity, rollback/forward-fix decision. | Any live issue, user report, degraded health, bad deploy. | Current SHA, health, logs/screenshots. | Read-only first; possible controlled write later. | Required before production changes. | [Incident response runbook](../incident-response-runbook.md) |
| Rollback | Verify whether application rollback is safe. | Suspected bad deployment with known good target. | Current SHA, target SHA, migration review. | Read-only verifier; production rollback is destructive/config change. | Required for actual rollback. | [Rollback checklist](../rollback-checklist.md) |
| Recovery / restore | Recovery posture and drill design. | Data loss, platform loss, restore planning, quarterly review. | Fresh backup/storage evidence. | Read-only unless owner approves disposable restore. | Required for restore/PITR/billing/data copy. | [Recovery readiness R8](../recovery-readiness-r8.md) |
| Security decisions | Reconciled security findings and open owner decisions. | Security review, write-path expansion, storage/RLS decisions. | Current code and migration evidence. | Read-only unless scoped change approved. | Required for security boundary changes. | [Security reconciliation R11](../security-reconciliation-r11.md) |
| Domain change | Candidate domain validation and cutover planning. | New domain, DNS change, auth redirect review. | Exact candidate domain and owner approval for changes. | Read-only verifier until cutover. | Required for DNS/Vercel/Supabase Auth changes. | [Domain change runbook](../domain-change-runbook.md) |
| Platform migration | Hosting portability and adapter requirements. | Considering Docker, VPS, Cloud Run, Azure, or another host. | Owner-selected target platform. | Local/read-only until migration goal. | Required for migration/deploy/env changes. | [Platform portability runbook](../platform-portability-runbook.md) |
| Supabase operations | Setup, schema/storage checks, backup/restore context. | Supabase project setup, env verification, recovery planning. | Supabase access; no secret logging. | Read-only unless explicitly approved. | Required for schema/data/storage/Auth changes. | [Supabase + Vercel setup checklist](../supabase-vercel-setup-checklist.md) |
| Production access | Required systems, owners, access loss impact. | Onboarding, access review, continuity planning. | Owner-defined account roster. | Documentation/read-only. | Required to change access or secrets. | [Access and dependency register](access-and-dependency-register.md) |
| First-run install | Create the first ordinary admin in a brand-new empty environment. | Disposable/new environment with zero active admins. | Confirm empty admin authority and health; do not use for live reset. | Server write in target environment. | Required for any non-disposable/live environment. | [First-run installation](first-run-installation.md) |
| Owner approvals | Defines change gates and emergency flow. | Before any production mutation. | Current baseline and diff. | Policy. | Owner is approval authority. | [Production change policy](production-change-policy.md) |

## Historical Material

Historical handoffs, audits, old current-status files, and archives remain evidence. Use [Documentation inventory](documentation-inventory.md) to understand whether a document is current, current with gaps, historical, superseded, contradictory, unverified, or owner-decision blocked.
