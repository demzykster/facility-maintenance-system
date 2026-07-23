# Domain Change Runbook

This runbook prepares Ogen CMMS for moving to another domain. It does not
authorize DNS changes, Vercel alias changes, Supabase Auth changes, production
environment changes, or disabling the old domain.

Strict rule: never cut over or remove the old domain without explicit owner
approval for the exact new domain.

## Current Evidence

- Current public URL observed during R11.5: `https://facility-maintenance-system.vercel.app`.
- Current production SHA observed through `/cmms-version.json`: `dd58142`.
- Current health endpoint observed as `ok` through `/api/health`.
- Vercel shows recent Ready deployment URLs for the
  `facility-maintenance-system` project, including the current generated
  production deployment URL.
- The repository contains hardcoded current-domain references mostly in
  staging smoke tooling, rollback/incident docs, historical handoffs, and tests.
  These are configurable or documentation references, not runtime app origins.

## Domain Dependency Inventory

| Area | Current behavior | Classification | Cutover impact |
| --- | --- | --- | --- |
| Browser app API calls | Same-origin relative `/api/...` paths | DOMAIN_INDEPENDENT | Should work on old and new domains if both serve the same deployment. |
| `/cmms-version.json` | Same-origin static version file | DOMAIN_INDEPENDENT | Used to prove deployed SHA on each domain. |
| `/api/health` | Public read-only same-origin health endpoint | DOMAIN_INDEPENDENT | Used to verify candidate domain before cutover. |
| PWA manifest | Served from same-origin `/manifest.webmanifest` via current app config | DOMAIN_INDEPENDENT | Candidate domain should serve the same manifest; installed PWA may need refresh/reinstall depending on browser behavior. |
| Service worker | Same-origin scope; notification click opens relative `data.url || "/"` | DOMAIN_INDEPENDENT | New domain gets its own service worker registration. Existing registrations do not migrate across origins. |
| Auth cookies | HttpOnly, `Path=/`, `SameSite=Lax`, `Secure` in production; no explicit `Domain` attribute | DOMAIN_INDEPENDENT | Cookies are host-bound. Users should expect to sign in again on the new domain. |
| Language cookie | `Path=/`, `SameSite=Lax`; no explicit domain | DOMAIN_INDEPENDENT | Language preference may need to be selected again on the new origin. |
| Local/session storage | Browser origin storage | DOMAIN_INDEPENDENT | Local UI state does not move to the new domain automatically. |
| Cleaning QR generation | Uses `window.location.origin` and current pathname when printing/generating QR URLs | CONFIGURABLE | Newly generated QR links follow the current domain. Existing printed QR stickers need separate validation. |
| Public cleaning API | `/api/public/zones` GET and `/api/public/complaints` POST | DOMAIN_INDEPENDENT | Must remain same-origin on the candidate domain. Do not submit production complaints for a smoke test. |
| Staging smoke tools | Many default to `https://facility-maintenance-system.vercel.app` | CONFIGURABLE | These should receive an explicit URL when testing a candidate domain. |
| Health/rollback tooling docs | Examples mention the current public URL | HARDCODED_SAFE | Examples must be adjusted during a real domain-specific runbook update. |
| Supabase Auth Site URL and Redirect URLs | External Supabase configuration, not stored in repo | EXTERNAL_CONFIGURATION | Must be updated before auth cutover testing. |
| Vercel custom domains and aliases | External Vercel configuration | EXTERNAL_CONFIGURATION | Must be attached and verified before use. |
| DNS | External owner-controlled configuration | OWNER_DECISION | Do not change from this repository. |

## Supabase Auth Checklist

The current repository cannot prove the live Supabase Auth Site URL or Redirect
URL list. Before testing a new public domain, the owner/operator must verify and
add the candidate domain in Supabase Auth settings.

For candidate `https://new.example.com`, prepare:

- Site URL: `https://new.example.com`.
- Redirect URL: `https://new.example.com`.
- Redirect URL with wildcard path, if Supabase project policy allows it:
  `https://new.example.com/**`.
- Keep the old production domain redirects during the transition:
  `https://facility-maintenance-system.vercel.app` and, if configured,
  `https://facility-maintenance-system.vercel.app/**`.
- Keep localhost/development redirect URLs separate from production URLs.
- If password recovery, email confirmation, magic links, or OAuth are enabled,
  verify each flow uses the candidate domain and does not redirect back to the
  old domain unexpectedly.

Do not remove old-domain Supabase redirects until recovery/password flows and
printed QR compatibility have been verified.

## Runtime Origin Handling

Preferred runtime model for this app:

1. Use relative URLs inside the browser app.
2. Use `window.location.origin` only for browser-generated links such as newly
   generated QR links.
3. Use explicitly configured trusted origins only for server-generated external
   links if such links are added later.
4. Do not trust spoofable request headers as canonical domain authority without
   a known allowlist.

Current R11.5 evidence found no runtime-critical hardcoded production origin in
`src/`, `server/`, `api/`, or `public/` that must be changed before testing a
candidate domain. The domain mentions in current tooling are operational
defaults and examples.

## Public QR and Cleaning Compatibility

The QR scanner is not an authentication flow. It is a public cleaning sticker
report flow.

Current code can generate QR URLs from the active browser origin. That means
newly generated stickers on a new domain should use the new domain.

Unknown that must be checked before old-domain removal:

- Whether already printed stickers contain absolute
  `https://facility-maintenance-system.vercel.app/...` URLs.
- Whether they contain only `czone:<id>` or query payloads that are
  domain-independent.
- Whether any redirect from old domain to new domain preserves full path and
  query, especially `?z=czone:<id>`.

If any printed QR stickers contain the old absolute domain, keep the old domain
active or redirect it to the new domain while preserving path and query. Do not
use an open redirect. Do not strip QR query parameters.

## Cookies, Sessions, and User Expectations

Current auth cookies are host-only because no cookie `Domain` attribute is set.
This is good for isolation, but it means existing browser sessions generally do
not migrate from one domain to another.

Expected behavior after cutover:

- Users may need to sign in again on the new domain.
- Remembered session state on the old domain may remain valid there until the
  old domain is disabled or cookies expire.
- The new domain has independent localStorage/sessionStorage.
- Service worker registration and PWA install state are origin-specific.

Do not try to copy session cookies between domains.

## Vercel and DNS Order

Use this order for a real owner-approved domain move:

1. Attach the new domain in Vercel.
2. Verify DNS and HTTPS readiness.
3. Keep the old domain active.
4. Add required Supabase Auth Site URL / Redirect URL entries.
5. Deploy code/config compatible with both domains.
6. Run `npm run domain:verify` against old and candidate domains.
7. Test login/recovery/email confirmation on the candidate domain.
8. Test public cleaning QR entry read-only; use a synthetic/local sticker test if
   a write would otherwise be required.
9. Switch canonical/public communication to the new domain.
10. Keep the old domain redirecting with path/query preservation.
11. Monitor `/api/health`, `/cmms-version.json`, login, and user reports.
12. Remove the old domain only after explicit later approval.

## Local Verification Command

R11.5 adds a read-only verifier:

```bash
npm run domain:verify -- \
  --current-url https://facility-maintenance-system.vercel.app \
  --candidate-url https://new.example.com \
  --expected-sha <current-sha>
```

The command:

- requires explicit URLs;
- rejects non-HTTPS candidate URLs;
- checks `/cmms-version.json`;
- checks `/api/health`;
- checks root GET and HEAD;
- checks `/api/public/zones` availability without printing zone contents;
- checks path/query preservation through a SPA route probe;
- returns stable JSON;
- performs no DNS, Vercel, Supabase, cookie, login, or data mutation.

## Rollback Plan

If candidate-domain validation fails before cutover:

- Do not change DNS.
- Do not remove old-domain Supabase redirects.
- Keep old domain active.
- Fix the specific failing category and rerun `npm run domain:verify`.

If a problem is discovered after cutover:

- Keep old domain reachable.
- Verify old-domain `/cmms-version.json` and `/api/health`.
- If Vercel alias/canonical routing caused the issue, revert only that approved
  domain/alias change.
- If Supabase Auth redirects caused the issue, restore the previous redirect
  allowlist while preserving evidence.
- Do not restore over production.

## Stop Conditions

Do not disable the old domain if any of these are true:

- Printed QR stickers use the old absolute domain.
- New domain is not present in Supabase Auth Site URL / Redirect URLs.
- Password recovery or email confirmation has not been verified.
- `/cmms-version.json` mismatch on candidate domain.
- `/api/health` is degraded on candidate domain.
- Candidate redirects lose path or query.
- Candidate redirects downgrade to HTTP.
- Runtime-critical code contains a hardcoded old production origin.
- Candidate domain requires an unapproved auth/security change.
- Rollback path is not clear.
- Owner has not approved the exact new domain and cutover window.
