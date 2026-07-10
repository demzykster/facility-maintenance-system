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
- PPE is managed through `/api/ppe`; normalized PPE tables are the production/API-mode authority, and production/API saves no longer create new PPE KV mirrors for the listed PPE prefixes.
- App config is managed through `/api/settings/config`; `config:v1` remains a compatibility mirror while normalized `app_config` is the production/API-mode authority.
