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
| Worker shifts (`משמרות עבודה`) | `הגדרות` -> `כללי` | `צוות ומשתמשים` | People data. Add a team-page sub-tab before removing from global settings. |
| Task statuses (`סטטוסים של מטלות`) | `הגדרות` -> `כללי` | `מטלות` -> settings sub-tab | Task workflow data. Gate editing explicitly before moving. |
| Vehicle types (`סוגי כלים`) | `הגדרות` -> `סוגי כלים` | `כלי שינוע` -> settings sub-tab | Fleet data. Split save handling from shared registries before removal. |
| Maintenance categories | `הגדרות` -> `אחזקה` | Stay in `הגדרות` -> `אחזקה` | Correct global maintenance configuration home. |
| Maintenance zones | `הגדרות` -> `רישומים` | `הגדרות` -> `אחזקה` | Zone routing belongs with maintenance settings. |
| Departments (`מחלקות`) | `הגדרות` -> `רישומים` | Stay global for now | Cross-cutting data used by users, tickets, and fleet. Add links from people/fleet pages if needed. |
| Suppliers | `הגדרות` -> `רישומים` and supplier module | Supplier module / global registry decision pending | Do not move until supplier ownership is reviewed. |
| PPE norms and clawback | `ביגוד עובדים` -> `הגדרות` | Stay in PPE module | Already module-local and expected by users. |
| Backup/restore | `הגדרות` | Stay in `הגדרות` with `settings:full` | Sensitive system action, not a module setting. |

## Recommended Move Order

1. Move task statuses to `מטלות` settings.
2. Move vehicle types to `כלי שינוע` settings.
3. Move worker shifts to `צוות ומשתמשים`.
4. Move maintenance zones into `אחזקה`.
5. Re-evaluate whether the remaining `רישומים` tab still has a clear purpose.

## Do Not Move Yet

- Departments: keep global until the site map review proves a better home.
- Suppliers: review supplier module ownership first.
- Backup/restore and other sensitive system actions: keep in global settings.
