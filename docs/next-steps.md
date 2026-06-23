# Next Steps

## Phase 2 - Stabilization

Goal: make the current GitHub baseline cleaner, reproducible, and safer before backend/database work.

## Step 1 - Fix Duplicate `createdAt`

Branch:

```powershell
git checkout -b codex/fix-duplicate-createdat
```

Target file:

```text
src/ClaudeMaintenanceApp.jsx
```

Current warning:

```text
Duplicate key "createdAt" in object literal
```

Relevant current fragment:

```jsx
onSave({ id: user.id || uid(), createdAt: user.createdAt || Date.now(), name: name.trim(), role,
  ...
  reportsTo: role === "user" ? reportsTo : "",
  active, createdAt: user.createdAt || Date.now(),
  employmentType: (role === "worker" || role === "cleaner") ? employmentType : (role === "tech" ? "contractor" : ""),
```

Expected minimal fix:

```jsx
  reportsTo: role === "user" ? reportsTo : "",
  active,
  employmentType: (role === "worker" || role === "cleaner") ? employmentType : (role === "tech" ? "contractor" : ""),
```

DoD:

- `npm run build` passes.
- Duplicate `createdAt` warning is gone.
- Bundle-size warning may remain.
- No UI or behavior changes intended.

## Step 2 - Vitest Skeleton

Branch:

```powershell
git checkout -b codex/vitest-skeleton
```

Tasks:

- Install `vitest`.
- Add scripts:
  - `test`: `vitest run`
  - optionally `test:watch`: `vitest`
- Add one small smoke test.

DoD:

- `npm test` runs and passes.
- `npm run build` still passes.

## Step 3 - Storage Contract Harness Test

Do not extract the real `store` from the monolith yet. That belongs to a later modular split phase.

For Phase 2, test the storage adapter contract through a small harness:

- `get(key, shared)` returns `{ value }` or `null`.
- `set(key, value, shared)` returns a non-`undefined` success value.
- `delete(key, shared)` returns a non-`undefined` success value.
- `list(prefix, shared)` returns `{ keys: [...] }`.

DoD:

- The contract is documented in executable test form.
- No modular split yet.

## Not In Phase 2

- No Supabase.
- No Railway.
- No production database.
- No RLS/Auth migration.
- No broad UI changes.
- No full monolith split.
- No whole-file replacement of `ClaudeMaintenanceApp.jsx`.
