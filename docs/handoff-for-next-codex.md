# Handoff For Next Codex

Updated: 2026-07-11

## Startup Checklist

- Repo: `/Users/Vadim/Documents/CMMS`
- Source of truth: GitHub `demzykster/facility-maintenance-system`, branch `main`.
- Current local state at handoff time: `main...origin/main`, clean.
- Latest app/UI commit before this handoff: `0832e63 Soften ticket status palette`.
- Product line: v1/main only.
- Active branch: none.
- Open PRs at last local handoff: none.
- Start every new session with:
  - `git status --short --branch`
  - `git fetch origin main`
  - `git log --oneline -5`
  - read `docs/active-work.md`

## Current Project Goal

The owner wants the existing v1 CMMS to reach a calm, usable, controlled-rollout state before any large architectural redesign.

The current strategy is:

1. Keep `main` stable and deployable.
2. Continue small, scoped fixes only.
3. Preserve the current monolithic UI for now; do not start a broad component split.
4. Keep production/API data authority normalized; do not recreate old KV mirrors.
5. Improve visual quality screen by screen without breaking workflows.
6. Keep mobile/iPhone usability tight: compact operational cards, no horizontal overflow, readable touch targets.
7. Leave a fresh independent architecture/security review and larger monolith/code-splitting work as later steps, not ad hoc nightly work.

## Current Product Status

- Status is best described as `production_candidate accepted for controlled rollout`, not `final_production`.
- R10 production data-core is effectively complete for the currently mapped v1 domains:
  - tickets;
  - fleet;
  - periodic maintenance;
  - users / `app_users`;
  - cleaning;
  - PPE;
  - work records;
  - settings records;
  - app config;
  - presence;
  - push subscriptions;
  - ticket photos / file metadata.
- Staging residual KV report previously reached `cmms_kv_records=0`.
- Route budget remains `19/24`.
- Known product/performance risk remains the large main JS chunk. The latest builds pass but still warn about a chunk above 500 kB.
- The live public Vercel app is staging/pilot/controlled rollout. Treat live data carefully.

## Recent Work Completed

Recent commits on `main`:

- `0832e63 Soften ticket status palette`
  - Replaced bright status-token colors with calmer brand-compatible tones.
  - Routed ticket-card SLA/risk/status/downtime badges through the muted token palette.
  - Updated `tests/statusTokenModel.test.js`.
- `c88b16e Tighten mobile dashboard cards`
  - Made mobile dashboard KPI blocks, notification card, and domain cards more compact.
  - Verified mobile dashboard at `390px` without horizontal overflow.
- `9417cef Restyle dashboard domain cards`
  - Restyled dashboard domain cards to match the newer operational dashboard language.
- `55a960c Fix worker status indicators`
  - Corrected worker card indicators: online / pending setup / last seen.
- `617e0d1 Add controlled rollout baseline`
  - Added `docs/controlled-rollout-baseline-2026-07-11.md`.
- `f480dc1 Remove dashboard KPI hover jitter`
  - Removed micro-jitter in dashboard KPI icons on hover.
- `009f48d Fix supplier cards and linked fleet rows`
  - Fixed supplier-card layout, linked fleet row behavior, and supplier add flow issues.

## Files Recently In Active Use

Primary active implementation file:

- `src/ClaudeMaintenanceApp.jsx`
  - Most UI changes are still here.
  - Do not replace this file wholesale.
  - Use precise patches only.

Shared models / tests recently touched:

- `src/statusTokenModel.js`
- `tests/statusTokenModel.test.js`
- `src/notificationPrefsModel.js`
- `tests/notificationPrefsModel.test.js`
- `src/pushNotificationModel.js`
- `public/cmms-sw.js`
- `docs/controlled-rollout-baseline-2026-07-11.md`
- `docs/active-work.md`
- `docs/handoff-for-next-codex.md`

Important docs to read before broad decisions:

- `docs/active-work.md`
- `docs/current-status.md`
- `docs/release-checklist.md`
- `docs/backlog.md`
- `docs/controlled-rollout-baseline-2026-07-11.md`

## What Changed In The UI Direction

The owner rejected the earlier "good enough" operational look as too old-fashioned in multiple screens.

Current visual direction:

- More premium, calm, operational SaaS.
- Brand palette:
  - main background: `#FFFFFF`
  - light section background: `#F7F8FA`
  - pearl gray: `#E6E7E9`
  - dark pearl / borders: `#C9CDD1`
  - muted text / icons: `#6F7680` and `#A4A9B0`
  - primary blue: `#1F4E8C`
  - blue hover: `#3E6DB0`
  - warm beige was tried as `#E9DFC9` and then cooled down because it looked too heavy.
- The owner wants critical blocks visually distinct, but not acidic.
- Ticket status colors should remain meaningful as "traffic-light" signals, but muted and brand-compatible.
- Hebrew RTL must be respected:
  - icons generally sit on the right side of Hebrew content;
  - alignment must be checked visually, not guessed from CSS.

Screens already touched in this design pass:

- dashboard;
- mobile dashboard;
- ticket cards;
- fleet list;
- suppliers cards and linked fleet rows;
- users / worker department tree;
- dashboard domain cards;
- dashboard KPI strips;
- logo/sidebar sizing;
- notification panel direction was explored.

## What Was Tried And Rejected / Needs Caution

- A notification panel that opened as a floating overlay over the side menu was rejected by the owner as visually wrong.
  - If continuing notifications UI, think of it as an integrated side drawer / inline side panel from the notification entry, not a centered modal floating over the menu.
- The warm beige `#E9DFC9` as a large dashboard band felt too heavy. Cooler neutral/warm hybrids worked better.
- The owner repeatedly caught RTL icon/text direction mistakes. Do not assume LTR layout habits.
- The owner disliked overly large mobile blocks. Mobile dashboard cards must be compact, not desktop cards stacked vertically.
- The owner disliked bright red/orange/blue pills in tickets. Use muted semantic token colors.
- Broad "let's split the monolith now" remains explicitly not the current next step.

## Known Issues / Watch List

Visual polish still likely needed:

- Some screens may still carry older bold/heavy typography or old-style controls:
  - settings;
  - cleaning;
  - analytics;
  - supplier detail;
  - PPE sub-tabs;
  - tasks / meetings;
  - remaining fleet detail areas.
- Mobile should be rechecked after every visual change.
- iPhone Safari/PWA icon caching was reported by the owner after reinstalling the app. If it recurs, inspect manifest/icon files and service-worker cache behavior.
- App issue log (`דיווחי בעיות במערכת`) should be checked periodically; keep useful reports, clear obvious stale/noise only when safe.
- Push/browser notifications:
  - Panel is the complete operational list.
  - OS/browser push should stay narrow and interrupt only for actionable events.
  - Read state should be per user, not global.

Technical/performance watch:

- Main bundle is still too large. Latest local build after recent UI changes produced a large chunk warning around 2 MB raw / about 503 kB gzip.
- Next meaningful performance work should reduce initial JS and defer post-login domain fetches, not start from visual rewrites.
- Live controlled-rollout baseline exists, but headless Chromium does not prove native iOS/Safari push-banner behavior.

## Validation Expectations

For code/UI changes:

- `npm run lint`
- `npm run build`
- focused tests for touched models, when applicable
- browser smoke on the changed screen
- mobile viewport check when UI changes affect dashboard/cards/lists/forms

Useful browser checks:

- no horizontal overflow;
- console errors/warnings are absent or understood;
- touched buttons remain at least mobile-usable;
- Hebrew RTL icon/text order looks intentional;
- live Vercel may lag GitHub by a few minutes after push.

For docs-only changes:

- `git diff --check`
- `npm run release:check` is enough when no app code changed.

## What Not To Do

- Do not touch v2 or Claude branches.
- Do not start using `src/app`, `src/features`, or `src/shared` as a new v1 modular architecture.
- Do not rebuild the app shell or router.
- Do not replace `src/ClaudeMaintenanceApp.jsx` wholesale.
- Do not manually edit production/staging database data or overwrite owner-entered staging data without explicit permission.
- Do not recreate retired KV mirrors or old experimental directions from archive docs.
- Do not make broad UI changes without checking the live screen in a browser.

## Recommended Next Steps

1. Let Vercel finish deploying `0832e63`, then visually check the live ticket cards.
2. Continue the same design-system polish on remaining old-looking screens:
   - settings first;
   - cleaning;
   - analytics;
   - PPE;
   - suppliers/fleet details.
3. Revisit notifications UI as an integrated side drawer, not as a centered modal.
4. Do a small manifest/PWA icon cache check if the old iPhone app icon still appears after deploy.
5. When UI dust settles, run a broader smoke:
   - `npm run release:check`
   - `npm run build`
   - existing demo UI smoke if available
   - optional live staging smoke only if credentials/environment are ready and the owner expects live verification.
6. Later: create a separate performance slice for code splitting / initial JS reduction.
