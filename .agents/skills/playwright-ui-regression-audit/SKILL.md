---
name: playwright-ui-regression-audit
description: Use for CMMS browser regression verification after UI, CSS, React extraction, routing, forms, overlays, modals, navigation, RTL, or production-like preview changes. Required when a CMMS visual or extraction change needs desktop/mobile screenshots, console/page error checks, and white-screen detection.
---

# Playwright UI Regression Audit

Follow the repository root `AGENTS.md` before using this skill.

Use this skill for real-browser proof. Prefer existing project smoke scripts when they match the task; otherwise use Playwright through the available browser/testing tools.

## Checklist

1. Start or identify the local preview/dev server only when needed.
2. Verify the affected route/screen at desktop width.
3. Verify a mobile/iPhone viewport.
4. Check Hebrew RTL layout, icon/text order, horizontal overflow, overlays/modals, and sticky/fixed UI.
5. Exercise the changed workflow: forms, navigation, open/close, save/cancel, empty/error/loading states when relevant.
6. Record console errors, page errors, failed requests, and white screens.
7. Capture screenshots or report precise visual observations.
8. Treat any remote URL as potentially production until the environment is confirmed.
9. Do not use production credentials without separate approval.
10. Do not save, create, update, or delete data in a remote environment without approval. Read-only viewing must not change application state.
11. If testing live/staging would write data, stop for owner approval.

## Do Not Use For

- Pure model/server changes with no browser behavior.
- Live/staging write smokes unless the owner explicitly approved that class of action.

## Completion Evidence

Report URL, confirmed environment and evidence for that identity, viewport(s), tested paths, observed errors, screenshots if captured, and any manual checks still needed.
