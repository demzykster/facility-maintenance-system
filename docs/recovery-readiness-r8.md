# Ogen R8 Recovery Readiness

Read-only verification date: 2026-07-22

This document records the current recovery posture after re-checking the live pilot / production-like controlled rollout. It does not authorize production restore, production rollback, PITR enablement, billing changes, secret rotation, or data export.

## Verified Baseline

- Branch: `main`
- Local `HEAD`: `97e6da4ecf6f8eb940ac4626282ffcae7c8dee4b`
- `origin/main`: `97e6da4ecf6f8eb940ac4626282ffcae7c8dee4b`
- Production `/cmms-version.json`: `97e6da4`
- Latest GitHub Actions `CI` on `main`: success for `97e6da4`
- Vercel production deployment: `Ready`
- Working tree before remediation: clean

## Current Recovery Inventory

### Application and deployment

- Git contains the application source, Vercel config, GitHub Actions, Supabase migrations, and recovery documentation.
- Vercel has multiple recent `Ready` production deployments for `facility-maintenance-system`.
- The deployed SHA can be verified through `/cmms-version.json`.
- Rollback capability exists through Vercel deployment history, but no fresh rollback drill was found for the current `97e6da4` baseline.

### Supabase database

- Current project ref: `ofwcdifzofzzucizpxqy`.
- Project identity: production-like controlled rollout serving the current public production URL. This is based on the collected live evidence: the public Vercel app at `facility-maintenance-system.vercel.app` accepted a Supabase/Auth token from this project during live smoke, `/api/session/me` returned the app profile, and the same project produced the current schema/data summaries. The repository documentation still uses staging/pilot language, so this should not be relabeled as final production without a separate owner decision.
- Managed physical backups are enabled: `walg_enabled=true`.
- PITR is currently disabled: `pitr_enabled=false`.
- Current listed completed backups:
  - `2026-07-21T07:04:08.734Z`
  - `2026-07-20T07:09:26.894Z`
  - `2026-07-19T07:03:52.855Z`
  - `2026-07-18T07:05:51.271Z`
  - `2026-07-17T07:05:10.144Z`
  - `2026-07-16T07:05:51.385Z`
  - `2026-07-15T07:06:07.997Z`
  - `2026-07-14T07:04:55.810Z`
- Local and remote migration history matched through `20260719120000`.
- `npm run staging:supabase-schema` passed for all current normalized tables and the private `cmms-files` bucket.

### Current table scope

The current recovery scope is larger than the old empty pilot drill. The latest read-only data summary found:

| Table | Rows |
| --- | ---: |
| `app_users` | 84 |
| `app_config` | 1 |
| `cmms_kv_records` | 0 |
| `cleaning_zones` | 11 |
| `cleaning_rounds` | 176 |
| `cleaning_complaints` | 0 |
| `fleet_units` | 124 |
| `locations` | 0 |
| `app_issue_reports` | 580 |
| `ppe_items` | 7 |
| `ppe_norms` | 36 |
| `ppe_movements` | 3 |
| `ppe_requests` | 4 |
| `ppe_orders` | 1 |
| `push_subscriptions` | 7 |
| `maintenance_tasks` | 0 |
| `maintenance_meetings` | 0 |
| `technician_presence` | 18 |
| `worker_absences` | 0 |
| `periodic_maintenance` | 0 |
| `tickets` | 22 |
| `file_metadata` | 34 |
| `audit_events` | 5715 |
| `ai_memory_facts` | 6 |
| `ai_conversations` | 1 |
| `ai_conversation_messages` | 0 |

`cmms_kv_records` has no residual prefixes, mirrors, transient operational records, deferred orphan candidates, or unknown records.

### Supabase storage

- Bucket: `cmms-files`
- Visibility: private
- Current read-only inventory: 2 objects, 195445 bytes
- `file_metadata` has 34 rows, while current storage inventory has 2 objects. This mismatch may be legitimate, but it has not yet been classified.
- A future consistency check must classify entries into:
  - active metadata with object;
  - soft-deleted or historical metadata;
  - metadata without object;
  - object without metadata;
  - external or non-storage reference, if supported by the model.

### Configuration and secrets

- `app_config` is a database-backed recovery item.
- Vercel environment variable names are present: `npm run staging:vercel-env` found all 18 required names and no optional missing names.
- Secret values are not stored in Git and were not inspected for this document.
- Recovery of secret values, VAPID keys, provider keys, and Supabase service-role keys depends on operator access to Vercel/Supabase and is not proven by repo state.

## Previous Findings Reconciled

| Finding | Current status | Evidence |
| --- | --- | --- |
| Current DB backup status unknown | `ALREADY_RESOLVED` | `supabase backups list` shows completed physical backups through 2026-07-21. |
| PITR disabled | `CONFIRMED_OPEN` | `pitr_enabled=false`. |
| Current full restore not proven | `CONFIRMED_OPEN` | Only old 2026-06-29 drill found, scoped to the first empty pilot. |
| Storage restore evidence limited | `CONFIRMED_OPEN` | Old drill verified one object by SHA-256; current storage inventory has 2 objects and 34 metadata rows. No independent current recoverable storage backup mechanism was verified. |
| RPO/RTO undocumented | `CONFIRMED_OPEN` | No owner-approved RPO/RTO target found. |
| Current rollback evidence missing | `CONFIRMED_OPEN` | Vercel deployment history exists, but no current rollback drill evidence found. |
| Secrets recovery undocumented | `CONFIRMED_OPEN` | Env names are checked; secret recovery/rotation procedure is not documented. |

## Recovery Scope Map

| Data | Source | Backup mechanism | Restore mechanism | Last verified | Granularity | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| Application source | Git | Git remote | Checkout/redeploy commit | 2026-07-22 | Commit | High |
| Vercel deployment | Vercel | Deployment history | Vercel rollback/redeploy | Deployment list verified 2026-07-22; rollback not drilled | Deployment | Medium |
| Migrations | `supabase/migrations` | Git | Apply migration history | 2026-07-22 | Full schema | High |
| Auth users | Supabase Auth | Supabase managed backup | Restore target / Auth restore | 2026-06-29 old drill | Whole project | Medium |
| `app_users` | Postgres | Supabase physical backup | DB restore | Current backup visible 2026-07-22; restore old drill only | Whole DB/table manually | Medium |
| `app_config` | Postgres | Supabase physical backup | DB restore | Backup visible; restore not drilled for current table | Whole DB/table manually | Medium |
| tickets/fleet/cleaning/PPE/work/PM | Postgres | Supabase physical backup | DB restore | Backup visible; current restore not drilled | Whole DB/table manually | Medium |
| `audit_events` | Postgres | Supabase physical backup | DB restore | Old drill and current backup visible | Whole DB/table manually | Medium |
| push subscriptions | Postgres | Supabase physical backup | DB restore | Backup visible; restore not drilled | Whole DB/table manually | Medium |
| AI tables | Postgres | Supabase physical backup | DB restore | Backup visible; restore not drilled | Whole DB/table manually | Medium |
| file metadata | Postgres | Supabase physical backup | DB restore | Old drill and current backup visible | Whole DB/table manually | Medium |
| storage objects | Supabase Storage | `UNVERIFIED` independent current storage backup mechanism | `UNVERIFIED`; historical one-object restore only | 2026-06-29 one-object SHA-256 restore, current inventory only | Object/bucket | Low |
| env/secrets | Vercel/Supabase dashboards | Operator/account controls | Re-enter/rotate secrets | Env names verified only | Secret-by-secret | Low |

## RPO/RTO Options

| Option | Expected max data loss | Expected recovery time | Cost/complexity | Feasibility |
| --- | --- | --- | --- | --- |
| Basic | Up to last completed daily DB backup; storage depends on platform/manual evidence | Hours to a day, depending on operator availability | Lowest | Feasible now, but needs current drill and documented manual process |
| Stronger | Minutes/hours for DB if PITR is enabled; storage still needs separate object plan | Lower, if restore target and env runbook are prepared | Requires owner approval for RPO, PITR/billing, and operations practice | Likely preferred only if the approved RPO is shorter than the daily backup interval and the current plan/cost supports PITR |
| High resilience | Near-zero for DB and storage only with additional replication/export/monitoring | Shortest, but requires rehearsed failover | Highest operational burden | Not justified without explicit owner decision |

Recommended decision point: define the owner-approved RPO first. PITR becomes the likely preferred database option only if that approved RPO is shorter than the daily backup interval and the current Supabase plan/cost supports it. Storage recovery still needs an explicit, separately verified mechanism.

## Fresh Drill Design

Never restore over production.

Use disposable Supabase/project environments. The drills must verify the current system, not only the old minimal scope.

### A. Full platform disaster restore

This is the drill that proves managed production-backup recovery.

1. Start from an actual managed backup.
2. Restore complete DB/Auth state into a disposable target, never over production.
3. Verify current schema and migration history in the restored target.
4. Verify application connectivity against the restored target.
5. Verify current representative tables, including `app_users`, `app_config`, tickets, fleet, cleaning, PPE, work, PM, audit, push, AI, and file metadata.
6. Verify storage recovery according to a confirmed platform or external storage recovery mechanism.
7. Verify at least one private storage object can be read through the restored application boundary.
8. Remove temporary credentials and delete disposable resources after evidence is recorded.

### B. Selective logical recovery

This drill proves targeted logical recovery only. It does not count as proof of managed production-backup restore.

1. Use sanitized or synthetic fixtures where appropriate.
2. Recover one ticket or one representative table record.
3. Recover one file and its metadata together.
4. Verify metadata/object consistency for:
   - active metadata with object;
   - soft-deleted or historical metadata;
   - metadata without object;
   - object without metadata;
   - external or non-storage reference, if supported by the model.
5. Verify the restored record/file through the application boundary.
6. Clean disposable fixtures/resources after evidence is recorded.

For either drill, capture a non-committed evidence snapshot from the production-like source:
   - schema/table counts;
   - migration history;
   - bucket privacy;
   - storage inventory;
   - selected sanitized representative rows if approved.

Owner approval is required before copying sensitive production data, creating a paid project, enabling PITR, changing backup retention, rotating secrets, or executing any restore.

## R8 Status

Repo-only remediation completed here:

- Current recovery scope documented.
- Previous recovery findings reconciled against current evidence.
- Fresh restore drill design documented.

No production, Supabase, Vercel, billing, secrets, Auth users, data, storage, or deployment configuration was changed.
