# Production Audit Events

Audit entity types are defined in `src/auditEventModel.js`.

Current entity types:

- `ticket`
- `user`
- `permission`
- `settings`
- `file`
- `fleet`
- `cleaning`
- `ppe`
- `task`
- `meeting`
- `system`

Sensitive shared KV writes emit audit events through `server/kv/permissionPolicy.js`.

Workflow records such as tickets, cleaning rounds, PPE requests, tasks, meetings, and app issue reports are not audited as sensitive KV writes by default; domain-specific lifecycle events should be added deliberately where needed.
