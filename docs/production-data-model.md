# Production Data Model

This is the first production mapping from current browser storage collections to future database tables.

The current source of truth is `DATA_COLLECTIONS` in `src/dataCollections.js`.

| Current backup key | Current storage prefix | Future table |
|---|---|---|
| `users` | `user:` | `app_users` |
| `fleet` | `fleet:` | `fleet_units` |
| `tickets` | `ticket:` | `tickets` |
| `pm` | `pm:` | `periodic_maintenance` |
| `insp` | `insp:` | `fleet_inspections` |
| `templates` | `itpl:` | `inspection_templates` |
| `presence` | `presence:` | `technician_presence` |
| `zones` | `czone:` | `cleaning_zones` |
| `rounds` | `cround:` | `cleaning_rounds` |
| `complaints` | `ccomplaint:` | `cleaning_complaints` |
| `absences` | `cabsence:` | `worker_absences` |
| `locations` | `location:` | `locations` |
| `tasks` | `mtask:` | `maintenance_tasks` |
| `meetings` | `mmeet:` | `maintenance_meetings` |
| `controlPrograms` | `controlProgram:` | `control_programs` |
| `controlAssignments` | `controlAssignment:` | `control_assignments` |
| `controlRuns` | `controlRun:` | `control_runs` |
| `controlFindings` | `controlFinding:` | `control_findings` |
| `ppe` | `ppe:` | `ppe_movements` |
| `ppeItems` | `ppeitem:` | `ppe_items` |
| `ppeNorms` | `ppenorm:` | `ppe_norms` |
| `ppeReqs` | `ppereq:` | `ppe_requests` |
| `ppeOrders` | `ppeorder:` | `ppe_orders` |
| protected file metadata | `/api/files` paths | `file_metadata` |
| production audit events | server-side write events | `audit_events` |

## Migration Notes

- Existing backup JSON can be read collection-by-collection using the `key` column.
- Existing local records can be read by `prefix`.
- Future tables should keep the existing record `id` as the primary migration key.
- User identity lives in Supabase Auth (`auth.users`). CMMS profile, role, active status, departments, and module permissions live in `public.app_users`.
- Demo/local backup photos may still appear under `photo:*` or inline cleaning photo fields for review compatibility.
- Production file bytes belong in Supabase Storage and production file ownership belongs in `file_metadata`; see `docs/production-file-metadata.md`.
- Production-sensitive changes need durable `audit_events`; see `docs/production-audit-events.md`.
- `config:v1`, `session:v1`, `theme:v1`, `login:v1`, and notification preferences are not business collections. They need separate treatment as configuration, session, or user preference data.
- `public.cmms_kv_records` is a temporary Postgres bridge for the existing key/value storage contract. It is not the final normalized business schema.
