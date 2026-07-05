# Hygiene Audit - 2026-07-05

Scope: small engineering hygiene before the next product slice. No Supabase data cleanup, reseed, storage migration, QR/round/compliance rewrite, or broad monolith split.

## Fixed In This Slice

- Replaced remaining browser `alert()` export/print failure messages in `src/ClaudeMaintenanceApp.jsx` with the existing app-level toast surface.
- Replaced old real-looking demo/user-form email examples with neutral `example.local` identities.
- Replaced the remaining real-looking company placeholder in settings with a neutral example company name.

## Legacy Inventory To Decide Separately

- `role === "cleaner"` remains as compatibility for old records/sessions and cleaning notifications. Do not remove it as part of unrelated UI work.
- `itpl:` / legacy inspection-template records remain allowed for read/history compatibility after authoring UI was removed.
- `appIssue:` remains a live internal issue-report feature, but old cleared reports must not be revived.
- Controls/tasks/meetings audit taxonomy still uses broad settings-style KV permission categories in places. Tighten this only as a focused permission/audit slice.
- `src/ClaudeMaintenanceApp.jsx` is still the main monolith. Continue extracting model/helper code only around touched behavior; do not start a broad split.

## Recommended Next Step

After this hygiene PR merges, pick one concrete product slice from current owner direction. For `בקרות -> ניקיון`, rebuild from fresh `main` as a production slice only when needed: manager/admin read-only cleaning overview plus manual manager cleaning-zone quality check, without migrating cleaning zones or changing QR/round/windows/compliance.
