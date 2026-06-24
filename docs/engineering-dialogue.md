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
