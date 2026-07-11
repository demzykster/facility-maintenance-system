# Controlled Rollout Baseline - 2026-07-11

Status: `production_candidate accepted for controlled rollout`

Scope: read-only/pre-rollout checks plus one safe push subscribe/unsubscribe smoke. No business behavior was changed.

## Snapshot

- Workspace: `/Users/Vadim/Documents/CMMS`
- Branch: `main`
- Git state before/after checks: `main...origin/main`
- HEAD: `02a688a` (`Reset active work after push hardening`)
- Live app: `https://facility-maintenance-system.vercel.app/`
- Live UI version observed: `CMMS CDSL · v0.1.0 · 02a688a`

## Verification Baseline

Commands passed:

- `npm run release:check`
  - `vercel-api-route`: `ok: 19/24 endpoint files`
  - `active-work-ledger`: `branch=main, active=none`
  - `production-config`: `ok for mode=demo, storage=local`
- `npm run build`
  - build passed
  - main JS chunk: `1,945.85 kB raw / 494.51 kB gzip`
  - known Vite large chunk warning remains
- `npm run staging:smoke:live`
  - app shell ok
  - bootstrap closed
  - admin auth ok
  - session profile ok
  - KV bridge read ok with `tickets=0`
  - file route auth boundary ok
  - Supabase table checks ok
  - file bucket `cmms-files` ok
- `npm run staging:smoke:browser`
  - login shell visible
  - identity input visible
  - failed responses: `0`
  - unauthenticated KV calls: `0`
  - console errors: `0`
- `npm run staging:smoke:ui -- --expect-current-commit`
  - desktop module sweep ok
  - mobile bottom navigation ok
  - expected commit `02a688a` visible in UI
- `npm run staging:kv:residuals`
  - `compatibilityMirrors=0`
  - `transientOperational=0`
  - `deferredOrphanCandidates=0`
  - `unknown=0`
- `npm run staging:data:summary`
  - `cmms_kv_records=0`
  - storage files `0`
  - storage bytes `0`
- `npm run staging:smoke:system-errors`
  - system error capture path ok
- `npm run staging:smoke:push-api`
  - temporary push subscription created and removed

Current live data summary at baseline:

- `app_users=19`
- `fleet_units=126`
- `cleaning_zones=11`
- `cleaning_rounds=34`
- `tickets=1`
- `file_metadata=27`
- `push_subscriptions=3`
- `audit_events=3618`
- `cmms_kv_records=0`
- storage files `0`

## 20-Minute Live Browser Observation

Window: `2026-07-11T08:40:14.631Z` to `2026-07-11T09:00:14.635Z`

Observed live app in headless Chromium:

- desktop cycles: `20/20 ok`
- mobile checks: `20/20 ok`
- relevant network failures: `0`
- relevant console messages: `0`
- page errors: `0`

Desktop modules exercised:

- dashboard
- tickets
- tasks
- PPE
- fleet
- cleaning
- users/team
- notifications

Limitation: headless Chromium does not prove native iOS/Safari push banner behavior. If iPhone Safari still shows repeated OS notifications, debug the push/service-worker delivery chain below.

## Performance Baseline

Three login-to-shell runs were collected for desktop and iPhone 14 emulation.

Desktop:

- shell visible: min `2978 ms`, median `3020 ms`, max `3322 ms`
- network idle: min `2979 ms`, median `3020 ms`, max `3323 ms`
- relevant failures: `0`
- console errors: `0`

Mobile iPhone 14 emulation:

- shell visible: min `2413 ms`, median `2510 ms`, max `2986 ms`
- network idle: min `2413 ms`, median `2510 ms`, max `5937 ms`
- relevant failures: `0`
- console errors: `0`

Observed startup shape:

- live main script transfer was about `404 kB`
- local production build main chunk was `494.51 kB gzip`
- normal login shell needs only a few early requests
- one mobile run loaded `23` API responses after shell, including settings, presence, tickets, fleet, PM, cleaning, users, PPE, work, and settings records

Performance implication: next optimization should reduce initial JS and defer post-login domain fetches. Do not start with broad UI rewrites.

## Safari / iPhone Push Checklist

Current contract:

- In-app notification panel remains the complete operational list.
- Browser / OS push must be narrower and only interrupt for events requiring action now.
- Panel-only kinds are enforced in both `src/pushNotificationModel.js` and `public/cmms-sw.js`.

Panel-only / non-interrupting:

- `doc`
- `pm`
- `ppe`
- tags starting with `sh-on-`
- tags starting with `sh-off-`

Server push path:

- `/api/push` `notify` requires business push permission.
- Non-interrupting events return `sent: 0`, `targets: 0`, `skipped: "non_interrupting"`.
- Push sends use `Promise.allSettled`.
- Push subscriptions are normalized in `public.push_subscriptions`.

If repeated Safari banners appear again:

1. Capture the exact banner title/body/tag/time on the iPhone.
2. Compare it against the in-app notification panel top item.
3. Check whether the kind is expected to interrupt:
   - interrupting: new ticket, important ticket update, SLA/escalation, cleaning issue, driver action, tasks/meetings, shift exception.
   - non-interrupting: `doc`, `pm`, `ppe`, normal shift start/end.
4. Run `npm run staging:smoke:push-api` to confirm subscribe/unsubscribe storage still works.
5. Inspect `public/cmms-sw.js` if the event kind should be filtered but still appears as an OS banner.
6. Inspect `/api/push` notify response if the server says `sent > 0` for a non-interrupting kind.
7. If only iPhone repeats while server is quiet, suspect Safari notification caching/delivery behavior and reset that device's notification permission/subscription.

## First 1-2 Days Observation Playbook

Run read-only checks if users report trouble:

```bash
npm run staging:smoke:browser
npm run staging:smoke:ui -- --expect-current-commit
npm run staging:kv:residuals
npm run staging:data:summary
npm run staging:smoke:system-errors
```

If login/PIN is reported:

```bash
npm run staging:smoke:pin-login
```

If tickets/files are reported:

```bash
npm run staging:smoke:tickets-api
```

If cleaning is reported:

```bash
npm run staging:smoke:cleaning-zones-api
npm run staging:smoke:cleaning-rounds-api
```

If PPE is reported:

```bash
npm run staging:smoke:ppe-api
```

If push is reported:

```bash
npm run staging:smoke:push-api
```

## Rollback / Triage Rules

Use this order before changing code:

1. Confirm live commit in the UI footer or with `npm run staging:smoke:ui -- --expect-current-commit`.
2. Check whether the issue reproduces in browser smoke or only on one device.
3. Run `npm run staging:data:summary` and confirm `cmms_kv_records=0` and storage is not unexpectedly growing.
4. Run the domain-specific smoke for the failing module.
5. If a new deploy caused the issue, prefer Vercel rollback to the previous known-good deployment before making rushed code changes.
6. If data was created by a smoke, make sure its script cleanup completed, then re-run `npm run staging:data:summary`.

Do not reopen R10 or start monolith extraction from a generic complaint. Reopen architecture only for a reproduced live bug, a failed smoke, or a specific independent audit finding against current `main`.

## Next Engineering Work After Observation

Recommended order:

1. Mobile startup/performance pass:
   - reduce initial JS;
   - defer domain fetches after shell;
   - measure iPhone cold start before and after.
2. Safari push debug only if real iPhone banners repeat.
3. CSP hardening.
4. Remove or serverize old browser `callClaude`.
5. Gradually replace source-regex wiring tests with behavioral contract tests.

