---
name: cmms-ui-rtl-design-audit
description: Use for CMMS React UI changes or reviews involving visual polish, Hebrew RTL, mobile/iPhone layout, design tokens, icons/text order, touch targets, overflow, typography, semantic status colors, accessibility, screenshots, or browser review. Required before completing any CMMS UI/visual change.
---

# CMMS UI RTL Design Audit

Follow the repository root `AGENTS.md` before using this skill.

## Workflow

1. Read `AGENTS.md`, `docs/current-state.md`, `docs/architecture-rules.md`, and the touched UI files.
2. Identify the exact screens, roles, and Hebrew/RTL states affected.
3. Check consistency with existing CMMS operational UI: dense, quiet, scannable, workflow-first.
4. Review design tokens, spacing, typography, semantic colors, badge intensity, icon/text order, focus states, empty/loading/error states, and accessible names.
5. Check mobile/iPhone constraints: interactive targets should aim for about 44 CSS px where practical, no horizontal overflow, cards not oversized, controls stable under long Hebrew labels.
6. Treat smaller controls as an explicit dense-operations exception: verify they remain usable, visually stable, and intentionally chosen for service UI density.
7. Pair with `playwright-ui-regression-audit` before completion: inspect the real screen on desktop, mobile, and Hebrew RTL, including console/page errors and screenshots or precise observations.

## Do Not Use For

- Backend-only changes with no user-visible UI.
- Marketing/landing-page redesign taste that is not part of the CMMS operational app.
- Broad shell rewrites; use extraction and architecture guardrails instead.

## CMMS-Specific Failure Modes

- New polished screens beside old-looking screens with no transition plan.
- Hebrew RTL order reversed for icons, metadata, badges, or action buttons.
- Bright badges or status colors that break the subdued operational palette.
- Visual claims made without opening the real screen after CSS/JSX changes.
- Completing a visual task based only on JSX/CSS review.
