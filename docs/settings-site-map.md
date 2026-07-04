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
| Task statuses (`סטטוסים של מטלות`) | `הגדרות` -> `כללי` | `מטלות` -> settings sub-tab | Task workflow data. Gate editing explicitly before moving. |
| Vehicle types (`סוגי כלים`) | `הגדרות` -> `סוגי כלים` | `כלי שינוע` -> settings sub-tab | Fleet data. Split save handling from shared registries before removal. |
| Maintenance categories | `הגדרות` -> `אחזקה` | Stay in `הגדרות` -> `אחזקה` | Correct global maintenance configuration home. |
| Maintenance zones | `הגדרות` -> `רישומים` | `הגדרות` -> `אחזקה` | Zone routing belongs with maintenance settings. |
| Departments (`מחלקות`) | `צוות ומשתמשים` -> `הגדרות` | Stay in `צוות ומשתמשים` -> `הגדרות` | Owner decision: department editing belongs next to people/workforce management. Preserve cross-module rename propagation. |
| Suppliers | `הגדרות` -> `רישומים` and supplier module | Supplier module / global registry decision pending | Do not move until supplier ownership is reviewed. |
| PPE norms and clawback | `ביגוד עובדים` -> `הגדרות` | Stay in PPE module | Already module-local and expected by users. |
| Periodic maintenance daily capacity (`קיבולת טיפולים יומית`) | `הגדרות` -> `כללי` | `כלי שינוע` -> `לוח טיפולים` / maintenance rules settings | Live setting. It affects PM distribution and belongs next to PM generation/rules, not in company-wide general settings. Move only when the fleet maintenance settings area has a clear home and save handler. |
| Default inspection interval (`ברירת מחדל לתדירות בקרה`) | `הגדרות` -> `כללי` | Remove from user-facing UI | Obsolete/confusing. Fleet inspection programs and future controls programs define their own intervals. Keep only a technical fallback in code if needed. |
| Cleaning round reminder (`תזכורת לפני סבב ניקיון`) | `הגדרות` -> `כללי` | `בקרת ניקיון` -> settings / future operations settings hub | Live setting. It belongs with cleaning rounds/windows, but do not move it until the cleaning module has a stable settings surface. |
| Global notification type toggles (`סוגי התראות`) | `הגדרות` -> `כללי` | Compact advanced block now; later `מדיניות התראות מערכת` | This is a system-wide notification policy, not personal filtering. Keep distinct from the notification panel's local user filters. Do not make it visually dominant because disabling a kind affects everyone. |
| Backup/restore | `הגדרות` | Stay in `הגדרות` with `settings:full` | Sensitive system action, not a module setting. |

## Recommended Move Order

1. Remove `ברירת מחדל לתדירות בקרה` from user-facing general settings; keep only a technical fallback if still needed by old code.
2. Make `סוגי התראות` a compact advanced `מדיניות התראות מערכת` block if it remains in global settings for now.
3. Move `קיבולת טיפולים יומית` only when it can sit naturally beside fleet PM generation/rules.
4. Move `תזכורת לפני סבב ניקיון` only when cleaning settings have a stable module-local home.
5. Move task statuses to `מטלות` settings.
6. Move vehicle types to `כלי שינוע` settings.
7. Move worker shifts to `צוות ומשתמשים`. Done in PR #75.
8. Move departments into the same `צוות ומשתמשים` -> `הגדרות` sub-tab. Done in PR #77.
9. Move maintenance zones into `אחזקה`.
10. Remove `רישומים` only when it has no remaining editable content.

## Do Not Move Yet

- Suppliers: review supplier module ownership first.
- Backup/restore and other sensitive system actions: keep in global settings.
- Live module settings without a stable module settings surface: do not move them just to make `הגדרות` look cleaner. First create the right home, then move the setting.
