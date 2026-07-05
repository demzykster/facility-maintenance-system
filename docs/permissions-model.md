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
- `userGroups`
- `analytics`
- `suppliers`
- `settings`
- `audit`

Admins receive full access by role. Non-admin users receive explicit permissions plus role defaults where defined.

## Notes

- Worker login setup/reset is controlled by `workerAccess`.
- User and worker management is controlled by `users`.
- PPE request/management uses `ppe`.
- Settings and backup/restore are intentionally restricted through `settings`.
