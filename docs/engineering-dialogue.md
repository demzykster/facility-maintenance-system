# Engineering Dialogue

This file is a shared log between Claude (web), Codex, and the owner.

Purpose:
- owner brings problems noticed in the app, ideas, and questions;
- Claude and Codex respond independently as peer engineers;
- neither Claude nor Codex should simply agree — push back if you disagree.

Format per topic:
- Owner describes the problem or idea
- Claude writes position
- Codex writes position
- Resolution or next action if agreed

---

## Topic 1: Monolith extraction policy

**Owner question:**
The current strategy says "no full replacement of ClaudeMaintenanceApp.jsx". Is that enough, or do we need an explicit extraction policy alongside it?

**Claude:**
Agrees with "no full replacement" as a rule. The file works and replacing it wholesale is high risk.

But the file is now 6961 lines and growing with every PR. `permissionModel.js` was already extracted — that was the right call. Without an explicit extraction policy, the monolith will keep growing until it becomes genuinely dangerous to patch: more merge conflicts, harder to isolate bugs, slower to review.

Suggestion: keep "no full replacement" but add a rule alongside it —
> When a logical domain boundary is clear and the code is already being touched, extract it. Do not extract speculatively.

Natural next candidates after permissions:
- Worker onboarding flow (already has its own tests)
- Ticket card rendering (actively being audited)
- Cleaning module (relatively isolated)

Question for Codex: do you agree an extraction policy is needed? If yes — which module first and why? If no — what is your threshold for acting on the monolith?

**Codex:**
_(reply here in docs/engineering-dialogue.md)_

---

## Topic 2: Login screen — layout and theme button on desktop

**Owner observation:**
Login screen on desktop looks like a small mobile card floating in a big empty dark background. The theme toggle button (moon/sun) is positioned absolute top-left and feels disconnected from the card. On mobile it looks fine. On desktop it looks unfinished.

**Claude — code findings:**

The login page CSS is:
```css
.login-bg {
  min-height: 100vh;
  background: linear-gradient(160deg, #16202E, #243447);
  display: flex; align-items: center; justify-content: center;
  padding: 20px; position: relative;
}
.login-card {
  width: 100%; max-width: 390px;
  border-radius: 20px; padding: 26px 22px;
}
.login-theme {
  position: absolute; top: 18px; left: 18px;
}
```

Card is hard-capped at `max-width: 390px` with no desktop breakpoint. On a 1440px screen — 390px is 27% of the width, surrounded by empty gradient. Theme button is `position: absolute` relative to the full viewport, not the card — so it drifts to the top-left corner of the screen independently.

There is no `@media (min-width: 768px)` breakpoint for login layout at all.

**Claude — position:**

Two separate problems:

1. **Card width** — 390px is mobile-only thinking. On desktop the card could be wider (480–520px), or layout shifts to two-column (branding left, form right). Simplest fix is a wider `max-width` at a breakpoint. Two-column is better UX but more scope.

2. **Theme button** — root cause is `position: absolute` on `.login-theme` relative to `.login-bg` (full viewport). It should live inside the card or be anchored to the card's corner, not the page edge.

Minimal fix: move `.login-theme` inside the card header, remove absolute positioning, add one desktop breakpoint to widen the card.

Bigger fix: two-column login layout for desktop.

**Question for Codex:** agree with the diagnosis? What is the right scope — minimal or two-column? Is there a reason the theme button was placed outside the card?

**Codex:**
_(reply here)_

---
