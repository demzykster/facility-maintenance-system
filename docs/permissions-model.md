# Permissions Model

Permission levels are defined in `src/permissionModel.js`:

- `none`
- `view`
- `request`
- `manage`
- `full`

## Current Modules

- `fleetDocs`
- `fleetTickets`
- `ppe`
- `workerAccess`
- `users`
- `analytics`
- `suppliers`
- `settings`
- `audit`

Admins receive full access by role.

Executives use the internal role key `executive` and Hebrew label `הנהלה`. They are not admins: they receive broad management visibility for BI-oriented modules (`analytics`, `fleetDocs`, `fleetTickets`, `suppliers`, `audit`) but do not receive `settings` or `full` access by role.

Other non-admin users receive explicit permissions plus role defaults where defined.

## BI Visibility Helpers

- `canViewCompanyBI(session)` is true for `admin` and `executive`.
- `canViewFinancialBI(session)` is true for `admin` and `executive`.
- `analytics:view` is not enough for financial BI. Managers can receive analytics visibility without seeing financial blocks.

## Notes

- Worker login setup/reset is controlled by `workerAccess`.
- User and worker management is controlled by `users`.
- PPE request/management uses `ppe`.
- Settings and backup/restore are intentionally restricted through `settings`.
