# Legacy Compatibility Inventory - 2026-07-05

This inventory records remaining compatibility surfaces after the hygiene cleanup. It is a decision aid, not permission to delete data or rewrite flows.

## Guardrails

- Do not clear, reseed, or overwrite Supabase data unless the owner explicitly asks.
- Do not revive old cleared `appIssue:` reports.
- Do not remove compatibility code from unrelated product slices.
- Do not migrate cleaning zones into `locations` as part of this cleanup.
- Do not start a broad split of `src/ClaudeMaintenanceApp.jsx`.

## `role === "cleaner"`

Status: compatibility bridge.

Why it exists:

- Older sessions and records may still use `role: "cleaner"`.
- Worker/cleaner PIN login still shares low-level server/session handling.
- Cleaning rounds, complaints, notifications, and i18n still include cleaner wording/history.

Current live surfaces:

- `server/session/initialPasswordHandler.js` keeps `worker` and `cleaner` as PIN roles.
- `server/kv/permissionPolicy.js` keeps `cleaner` in active roles and selected write permissions.
- `src/loginIdentifierModel.js`, `src/workerAccessModel.js`, `src/cleaningAccessModel.js`, and related tests keep worker/legacy-cleaner compatibility.
- `src/ClaudeMaintenanceApp.jsx` still routes a legacy cleaner session to `CleanerApp`, while new editable user flows normalize cleaner-like users toward `worker + ניקיון`.

Decision:

- Keep this compatibility until a focused cleanup can prove login/session/KV/UI behavior for old cleaner records is no longer needed.
- New product work should continue using `worker + cleaningAccess` and helper-based gates.
- A future removal PR must include targeted tests for PIN login, cleaning notifications, KV permission policy, and worker cleaning access.

## Legacy Inspection Templates: `itpl:` / `inspection_templates`

Status: read/history compatibility.

Why it exists:

- Authoring UI for old `שאלונים` was removed.
- Old `insp:` records may still carry `templateId` for labels/history.
- Backup/data-collection and KV allowlists still know the `itpl:` prefix.

Current live surfaces:

- `src/dataCollections.js` maps `templates` -> `itpl:` -> `inspection_templates`.
- `server/kv/handler.js` and `server/kv/permissionPolicy.js` still allow `itpl:`.
- `src/ClaudeMaintenanceApp.jsx` still reads old template labels for inspection history.
- `src/inspectionProgramModel.js` still normalizes old `templateId` fallback keys.

Decision:

- Keep `itpl:` as read/history compatibility for now.
- Do not add new authoring UI.
- A future removal PR should first remove the old label dependency or make it safely optional, then update backup/KV/data-collection tests.

## `appIssue:`

Status: active internal report feature, not an active backlog of old reports.

Why it exists:

- Users can still report app issues from the UI with sanitized screenshot/context.
- Admin settings can still review/respond to currently stored reports.
- The owner-cleared historical reports must not be reintroduced from old chat history or local artifacts.

Current live surfaces:

- `src/appIssueModel.js` and `src/appIssueScreenshot.js`.
- `src/dataCollections.js`, `server/kv/handler.js`, and `server/kv/permissionPolicy.js` register `appIssue:`.
- `src/ClaudeMaintenanceApp.jsx` loads/saves `appIssue:` and exposes report buttons/settings.

Decision:

- Keep the feature unless the owner explicitly asks to remove it.
- Never restore old cleared records.
- If the feature is removed later, do it as a product decision with UI, KV, backup, and tests updated together.

## Audit / Permission Taxonomy

Status: coarse but acceptable for v1 compatibility.

Current live surfaces:

- `server/kv/permissionPolicy.js` maps `mtask:` / `mmeet:` and controls prefixes to `settings` audit entity type.
- Controls write permissions already use the `controls` module and levels, but audit entity naming is not yet domain-specific.

Decision:

- Do not mix taxonomy cleanup into feature work.
- A focused PR can add clearer audit entity types for `tasks`, `meetings`, and `controls`, then update `kvPermissionPolicy` and audit tests.
- This is a good next engineering slice before deeper production hardening.

## Recommended Next Slice

If continuing cleanup, prefer one focused PR:

1. Add explicit audit entity types for tasks, meetings, and controls.
2. Keep permissions unchanged.
3. Update tests so behavior stays identical except the audit classification.

If continuing product work, open a concrete `בקרות` slice only after choosing the exact operator/admin workflow. Avoid placeholder UI bridges.
