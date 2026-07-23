# Operational Documentation Inventory

Last verified against local commit: `24213dc` with production/origin baseline `567a5f9`.

Status meanings:

- `CURRENT`: usable as current operational guidance after baseline verification.
- `CURRENT_WITH_GAPS`: usable, but contains known missing decisions or needs fresh evidence before action.
- `HISTORICAL`: evidence/history only; not a current procedure.
- `SUPERSEDED`: replaced by a canonical operational doc.
- `CONTRADICTORY`: conflicts with current Git/production facts and must not be used as current state.
- `UNVERIFIED`: plausible but not re-proven in this R12 audit.
- `OWNER_DECISION`: blocked on owner-defined access, target, RPO/RTO, or policy.

| Document | Status | Notes / canonical replacement |
|---|---|---|
| `README.md` | `CURRENT_WITH_GAPS` | Good repo entry; should point future operators to `docs/operations/README.md`. |
| `AGENTS.md` | `CURRENT` | Repo-local harness and source order. |
| `docs/current-state.md` | `CURRENT` | Updated during R12 to current baseline and operations entry points. |
| `docs/operations/README.md` | `CURRENT` | Canonical operations entry point. |
| `docs/operations/runbook-index.md` | `CURRENT` | Canonical runbook map. |
| `docs/operations/production-change-policy.md` | `CURRENT` | Canonical production change policy. |
| `docs/operations/business-continuity-guide.md` | `CURRENT_WITH_GAPS` | Owner contacts/access details remain `OWNER TO DEFINE`. |
| `docs/operations/access-and-dependency-register.md` | `CURRENT_WITH_GAPS` | DNS provider and account owners need owner confirmation. |
| `docs/operations/environment-reference.md` | `CURRENT_WITH_GAPS` | Names verified from code/workflows/templates; secret values intentionally absent. |
| `docs/operations/checklists/daily-health.md` | `CURRENT` | Read-only daily checklist. |
| `docs/operations/checklists/release.md` | `CURRENT` | Production release checklist. |
| `docs/operations/checklists/incident.md` | `CURRENT` | Incident checklist. |
| `docs/operations/checklists/quarterly-readiness.md` | `CURRENT` | Periodic readiness checklist. |
| `docs/monitoring-runbook.md` | `CURRENT` | R9 monitoring; manual workflow only. |
| `docs/incident-response-runbook.md` | `CURRENT` | R10 incident response. |
| `docs/rollback-checklist.md` | `CURRENT` | Owner-approved rollback only. |
| `docs/recovery-readiness-r8.md` | `CURRENT_WITH_GAPS` | Recovery inventory is useful; data counts/backups must be refreshed before restore decisions. |
| `docs/domain-change-runbook.md` | `CURRENT_WITH_GAPS` | Current process valid; embedded R11.5 SHA is historical evidence, not current production. |
| `docs/domain-change-checklist.md` | `CURRENT_WITH_GAPS` | Use with current SHA/domain verification. |
| `docs/platform-portability-runbook.md` | `CURRENT_WITH_GAPS` | Local R11.6 result; non-Vercel targets require adapter. |
| `docs/platform-portability-checklist.md` | `CURRENT_WITH_GAPS` | Use before future platform experiment. |
| `docs/security-reconciliation-r11.md` | `CURRENT_WITH_GAPS` | Reconciled findings; open owner decisions remain. |
| `docs/supabase-vercel-setup-checklist.md` | `CURRENT_WITH_GAPS` | Setup guide; verify against current env/migrations before use. |
| `docs/staging-smoke.md` | `CURRENT_WITH_GAPS` | Useful smoke docs; some staging language should be interpreted as production-like live pilot. |
| `docs/release-checklist.md` | `CURRENT_WITH_GAPS` | Detailed historical release checklist; use `docs/operations/checklists/release.md` first. |
| `docs/production-platform-decision.md` | `CURRENT_WITH_GAPS` | Platform decision background; R11.6 adds portability caveat. |
| `docs/production-storage-provider.md` | `CURRENT_WITH_GAPS` | Storage authority background; verify before data changes. |
| `docs/production-data-model.md` | `CURRENT_WITH_GAPS` | Data collection background; verify against current migrations/code. |
| `docs/production-bootstrap.md` | `CURRENT_WITH_GAPS` | Bootstrap guidance; do not enable bootstrap without owner approval. |
| `docs/production-file-storage.md` | `CURRENT_WITH_GAPS` | File storage guidance; verify bucket/policies before changes. |
| `docs/production-file-metadata.md` | `CURRENT_WITH_GAPS` | Metadata guidance; verify current schema before changes. |
| `docs/production-audit-events.md` | `CURRENT_WITH_GAPS` | Audit model background. |
| `docs/production-ai.md` | `CURRENT_WITH_GAPS` | AI production guidance; current enabled flags/permissions must be verified live before action. |
| `docs/ai-agent-readiness.md` | `HISTORICAL` | Architecture target/background. Current AI state lives in code/current-state/operations docs. |
| `docs/architecture/cmms-agent-core.md` | `HISTORICAL` | Future architecture direction, not current operations. |
| `docs/handoffs/inline-ai-ticket-intake-handoff.md` | `HISTORICAL` | Completed inline AI handoff; use as evidence only. |
| `docs/audits/system-errors-and-user-feedback-review-2026-07-20.md` | `HISTORICAL` | Sampled audit evidence; monitoring still required. |
| `docs/active-work.md` | `HISTORICAL` | Historical ledger; does not override current state. |
| `docs/current-status.md` | `HISTORICAL` | Archived status. |
| `docs/handoff-for-next-codex.md` | `HISTORICAL` | Detailed old handoff; verify before use. |
| `docs/archive/*` | `HISTORICAL` | Preserved historical reports. |

## Contradictions Reconciled

- Old `docs/current-state.md` baseline `b052082` was replaced with the R12 verified baseline.
- Older handoffs and status files that cite old SHAs remain historical evidence, not current state.
- R11.5 and R11.6 runbooks contain their own audit-time SHAs; these are not current-state claims unless re-verified.
