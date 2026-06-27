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
| `tasks` | `mtask:` | `maintenance_tasks` |
| `meetings` | `mmeet:` | `maintenance_meetings` |
| `ppe` | `ppe:` | `ppe_movements` |
| `ppeItems` | `ppeitem:` | `ppe_items` |
| `ppeNorms` | `ppenorm:` | `ppe_norms` |
| `ppeReqs` | `ppereq:` | `ppe_requests` |
| `ppeOrders` | `ppeorder:` | `ppe_orders` |

## Migration Notes

- Existing backup JSON can be read collection-by-collection using the `key` column.
- Existing local records can be read by `prefix`.
- Future tables should keep the existing record `id` as the primary migration key.
- User identity lives in Supabase Auth (`auth.users`). CMMS profile, role, active status, departments, and module permissions live in `public.app_users`.
- Photos are not included here as tables yet. They currently live under `photo:*` storage keys and should move to object storage with metadata references from tickets/reports.
- `config:v1`, `session:v1`, `theme:v1`, `login:v1`, and notification preferences are not business collections. They need separate treatment as configuration, session, or user preference data.
