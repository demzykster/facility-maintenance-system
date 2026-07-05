# Production Data Model

`src/dataCollections.js` is the source of truth for business collections that round-trip through backup/restore and future production storage.

| Key | KV prefix | Future table |
| --- | --- | --- |
| `users` | `user:` | `app_users` |
| `fleet` | `fleet:` | `fleet_units` |
| `tickets` | `ticket:` | `tickets` |
| `pm` | `pm:` | `periodic_maintenance` |
| `presence` | `presence:` | `technician_presence` |
| `zones` | `czone:` | `cleaning_zones` |
| `rounds` | `cround:` | `cleaning_rounds` |
| `complaints` | `ccomplaint:` | `cleaning_complaints` |
| `absences` | `cabsence:` | `worker_absences` |
| `locations` | `location:` | `locations` |
| `tasks` | `mtask:` | `maintenance_tasks` |
| `meetings` | `mmeet:` | `maintenance_meetings` |
| `ppe` | `ppe:` | `ppe_movements` |
| `ppeItems` | `ppeitem:` | `ppe_items` |
| `ppeNorms` | `ppenorm:` | `ppe_norms` |
| `ppeReqs` | `ppereq:` | `ppe_requests` |
| `ppeOrders` | `ppeorder:` | `ppe_orders` |
| `appIssues` | `appIssue:` | `app_issue_reports` |
