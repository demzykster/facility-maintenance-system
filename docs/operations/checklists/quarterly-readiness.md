# Quarterly Readiness Checklist

Run read-only first. Any write, restore, billing, platform, DNS, env, or production data action requires owner approval.

- [ ] Verify current `main`, `origin/main`, production SHA, and health.
- [ ] Review R8 recovery readiness and refresh backup/storage evidence.
- [ ] Decide whether RPO/RTO and PITR remain `OWNER TO DEFINE`.
- [ ] Run or plan a disposable restore drill if approved.
- [ ] Run rollback verifier against a safe target scenario.
- [ ] Review manual health monitor workflow.
- [ ] Review incident response runbook and last incidents.
- [ ] Review security reconciliation open owner decisions.
- [ ] Run domain portability verifier if a domain change is being considered.
- [ ] Run platform verifier for any candidate host under discussion.
- [ ] Review dependency updates and Node/npm version drift.
- [ ] Review access and dependency register.
- [ ] Review environment reference for new/removed variables.
- [ ] Run docs verifier:
  ```bash
  npm run docs:verify
  ```
- [ ] Identify stale owner decisions and assign explicit follow-up goals.
