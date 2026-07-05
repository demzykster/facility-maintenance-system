# Settings Site Map

Purpose: define where configuration belongs before moving settings between screens. This keeps settings discoverable and avoids duplicate controls.

## Placement Rules

- Global settings stay in `הגדרות` only when they affect the whole system or several modules equally.
- Module-specific settings should live next to the module where the owner uses them.
- People/workforce settings should live in `צוות ומשתמשים`.
- Sensitive system actions need `settings:full`; ordinary module configuration should use the module's own manage permission when that permission exists.
- Each move should be its own PR with its own save handler check. Do not move Topics 10, 11, and 12 together.

## Current And Intended Homes

| Area | Current Home | Intended Home | Notes |
| --- | --- | --- | --- |
| Worker shifts (`משמרות עבודה`) | `צוות ומשתמשים` -> `הגדרות` | Stay in `צוות ומשתמשים` -> `הגדרות` | People data. Owner clarified that workforce settings should share one `הגדרות` sub-tab. |
| Task statuses (`סטטוסים של מטלות`) | `מטלות` -> `הגדרות` | Stay in `מטלות` -> `הגדרות` | Task workflow data. Editing is explicitly gated by settings permission inside the tasks module. |
| Vehicle types (`סוגי כלים`) | `הגדרות` -> `סוגי כלים` | `כלי שינוע` -> settings sub-tab | Fleet data. Split save handling from shared registries before removal. |
| Maintenance categories | `הגדרות` -> `אחזקה` | Stay in `הגדרות` -> `אחזקה` | Correct global maintenance configuration home. |
| Maintenance zones | `הגדרות` -> `רישומים` | `הגדרות` -> `אחזקה` | Zone routing belongs with maintenance settings. |
| Departments (`מחלקות`) | `צוות ומשתמשים` -> `הגדרות` | Stay in `צוות ומשתמשים` -> `הגדרות` | Owner decision: department editing belongs next to people/workforce management. Preserve cross-module rename propagation. |
| Suppliers | `הגדרות` -> `רישומים` and supplier module | Supplier module / global registry decision pending | Do not move until supplier ownership is reviewed. |
| PPE norms and clawback | `ביגוד עובדים` -> `הגדרות` | Stay in PPE module | Already module-local and expected by users. |
| Periodic maintenance daily capacity (`קיבולת טיפולים יומית`) | `הגדרות` -> `כללי` | `כלי שינוע` -> `לוח טיפולים` / maintenance rules settings | Live setting. It affects PM distribution and belongs next to PM generation/rules, not in company-wide general settings. Move only when the fleet maintenance settings area has a clear home and save handler. |
| Cleaning round reminder (`תזכורת לפני סבב ניקיון`) | `הגדרות` -> `כללי` | `בקרת ניקיון` -> settings / future operations settings hub | Live setting. It belongs with cleaning rounds/windows, but do not move it until the cleaning module has a stable settings surface. |
| Global notification type toggles (`סוגי התראות`) | `הגדרות` -> `כללי` compact `מדיניות התראות מערכת` block | Later dedicated notification policy screen if needed | This is a system-wide notification policy, not personal filtering. Keep distinct from the notification panel's local user filters. Do not make it visually dominant because disabling a kind affects everyone. |
| Backup/restore | `הגדרות` | Stay in `הגדרות` with `settings:full` | Sensitive system action, not a module setting. |

## Recommended Move Order

1. Done: make `סוגי התראות` a compact advanced `מדיניות התראות מערכת` block while it remains in global settings.
2. Move `קיבולת טיפולים יומית` only when it can sit naturally beside fleet PM generation/rules.
3. Move `תזכורת לפני סבב ניקיון` only when cleaning settings have a stable module-local home.
4. Done: move task statuses to `מטלות` settings.
5. Move vehicle types to `כלי שינוע` settings.
6. Move worker shifts to `צוות ומשתמשים`. Done in PR #75.
7. Move departments into the same `צוות ומשתמשים` -> `הגדרות` sub-tab. Done in PR #77.
8. Move maintenance zones into `אחזקה`.
9. Remove `רישומים` only when it has no remaining editable content.

## Do Not Move Yet

- Suppliers: review supplier module ownership first.
- Backup/restore and other sensitive system actions: keep in global settings.
- Live module settings without a stable module settings surface: do not move them just to make `הגדרות` look cleaner. First create the right home, then move the setting.
