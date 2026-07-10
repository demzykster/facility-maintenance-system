# Production Storage Provider

The shared KV API only accepts known v1 prefixes. Keep `server/kv/handler.js`, `server/kv/permissionPolicy.js`, and `src/dataCollections.js` aligned.

## Current Prefix Families

- `config:v1`
- `user:`
- `fleet:`
- `ticket:`
- `pm:`
- `photo:`
- `presence:`
- `location:`
- `czone:`
- `cround:`
- `ccomplaint:`
- `cabsence:`
- `mtask:`
- `mmeet:`
- `ppe:`
- `ppeitem:`
- `ppenorm:`
- `ppereq:`
- `ppeorder:`
- `appIssue:`
- `pushSubscriptions:v1`

## Permission Boundaries

- User profile writes require `users:manage`.
- Config, fleet, PM, photos, locations, cleaning setup, and absences require `settings:manage`.
- Ticket writes are workflow writes for admin, manager, technician, and worker roles.
- Cleaning rounds and complaints use cleaning access helpers.
- Task and meeting writes are workflow writes for admin and manager roles.
- PPE catalog/order writes require `ppe:manage`; PPE requests require `ppe:request` or worker/cleaner request flow.
- App issue reports are accepted from active product roles.
- Phone push subscriptions are managed through `/api/push`; normalized `push_subscriptions` is the production/API-mode authority, and staging has retired the aggregate `pushSubscriptions:v1` compatibility key after the guarded retire check passed.
- PPE is managed through `/api/ppe`; normalized PPE tables are the production/API-mode authority, production/API saves no longer create new PPE KV mirrors for the listed PPE prefixes, and staging has retired all matched PPE mirrors.
- Tickets are managed through `/api/tickets`; normalized `tickets` is the production/API-mode authority, production/API saves no longer create new `ticket:*` KV mirrors, and staging has retired the matched ticket mirror.
- Cleaning is managed through `/api/cleaning/records`; normalized cleaning tables are the production/API-mode authority, production/API saves no longer create new cleaning KV mirrors for `czone:`, `cround:`, `ccomplaint:`, or `cabsence:`, and staging has retired all matched cleaning zone/round mirrors.
- Fleet is managed through `/api/fleet`; normalized `fleet_units` is the production/API-mode authority, production/API saves/imports/deletes no longer create new `fleet:*` KV mirrors, and staging has retired all matched fleet mirrors.
- Periodic maintenance is managed through `/api/pm`; normalized `periodic_maintenance` is the production/API-mode authority, and production/API saves/batch saves/deletes no longer create new `pm:*` KV mirrors.
- Work records are managed through `/api/work`; normalized `maintenance_tasks` and `maintenance_meetings` are the production/API-mode authority, and production/API saves/deletes no longer create new `mtask:*` or `mmeet:*` KV mirrors.
- App config is managed through `/api/settings/config`; normalized `app_config` is the production/API-mode authority, production/API saves no longer create new `config:v1` KV mirrors, and staging has retired the app-config mirror.
- Users are managed through `/api/users`; normalized `app_users` is the production/API-mode authority, and production/API user saves/deletes no longer create or require `user:*` KV mirrors.
