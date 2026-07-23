# Domain Change Checklist

Use this only after the owner approves the exact candidate domain. Do not change
DNS, Vercel aliases, Supabase Auth settings, or production environment variables
from this checklist without that approval.

- Do not change DNS before the exact owner-approved cutover step.

## Before Candidate Test

- Record current production URL.
- Record current production SHA from `/cmms-version.json`.
- Record current `/api/health` result.
- Confirm the candidate domain is attached in Vercel and HTTPS-ready.
- Add candidate Site URL and Redirect URLs in Supabase Auth.
- Keep old-domain Supabase redirects in place.
- Confirm old domain remains active.
- Confirm no old-domain hardcoded runtime origin remains in app code.
- Confirm printed QR sticker format:
  - domain-independent token/query; or
  - old absolute URL with a preserved path/query redirect plan.

## Verify Candidate

Run:

```bash
npm run domain:verify -- \
  --current-url https://facility-maintenance-system.vercel.app \
  --candidate-url https://new.example.com \
  --expected-sha <current-sha>
```

Pass conditions:

- candidate URL is HTTPS;
- candidate `/cmms-version.json` matches expected SHA;
- candidate `/api/health` is `ok`;
- root GET and HEAD respond;
- public cleaning zones route responds;
- path/query probe is preserved;
- no redirect loop;
- no HTTP downgrade.

## Manual App Checks

- Login works on candidate domain.
- Logout works on candidate domain.
- Password recovery / email confirmation works if enabled.
- Browser tab title and manifest load.
- Service worker does not show critical errors.
- Public QR entry opens without login.
- Do not submit real production cleaning complaints during smoke.
- Existing old domain still works or redirects safely.

## Cutover

- Change only the approved DNS/Vercel domain item.
- Verify Vercel deployment is Ready.
- Verify `/cmms-version.json` on candidate domain.
- Verify `/api/health` on candidate domain.
- Verify login on candidate domain.
- Keep old domain active or redirecting with path/query preserved.
- Monitor errors and user reports.

## Stop

Stop and keep the old domain active if:

- Supabase Auth redirects are incomplete;
- candidate SHA or health does not match;
- redirects lose path/query;
- old QR stickers depend on the old domain and no redirect is ready;
- sessions fail in a way that is more than normal re-login;
- owner approval does not cover the exact domain/action.
