# Incident Checklist

- [ ] Timestamp and timezone.
- [ ] Incident severity.
- [ ] Detection source.
- [ ] Affected users, roles, routes, and devices.
- [ ] Current production SHA:
  ```bash
  curl -fsS https://facility-maintenance-system.vercel.app/cmms-version.json
  ```
- [ ] Current health:
  ```bash
  curl -fsS https://facility-maintenance-system.vercel.app/api/health
  ```
- [ ] Latest CI status.
- [ ] Latest deployment status.
- [ ] Relevant logs/request IDs.
- [ ] Screenshots or reproduction steps.
- [ ] Evidence preserved before mitigation.
- [ ] Decide with owner: monitor, rollback, or forward-fix.
- [ ] If rollback is considered, run rollback verifier.
- [ ] If data recovery is considered, use recovery runbook and never restore over production.
- [ ] Apply only approved mitigation.
- [ ] Verify version, health, and affected workflow.
- [ ] Record resolution and final SHA.
- [ ] Record follow-up tests/docs needed.
