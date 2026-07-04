# Ближайшая Стратегия Работы

Дата: 2026-07-04.

Этот документ коротко фиксирует ближайший порядок после cleanup PR #591-#600.

## Что Уже Закрыто

- Зафиксирован целевой продуктовый blueprint для `בקרות`.
- Зафиксирован аудит текущего состояния.
- Устаревшие Supabase/status docs обновлены.
- Небезопасный client-side AI path отключен.
- Legacy `שאלונים` / inspection-template authoring убран.
- `מטלות` начали становиться shared action layer: задачи сохраняют `source*` связи.
- `locations` получили migration boundary и pure helper model.
- Решено: `cleaner` не остается долгосрочной core role. Будущая модель: `worker + cleaning access/capability`.
- Зафиксировано: текущие users/history/app data не ценны для миграции, пока owner не скажет иначе. Destructive Supabase cleanup все равно только по явной команде.

## Ближайший Правильный Шаг

Сначала не строить UI `בקרות`.

Следующий безопасный PR:

```text
codex/cleaning-access-model
```

Содержание:

- pure model/helper file;
- tests;
- legacy `role === "cleaner"` compatibility;
- no UI rewrite;
- no Supabase migration;
- no KV policy rewrite yet;
- no data cleanup.

Ожидаемые helpers:

- `isWorkerLike(user)`
- `hasCleaningAccess(user)`
- `canPerformCleaning(user)`
- `canReceiveCleaningComplaints(user)`
- `canCloseCleaningComplaints(user)`
- `canManageCleaningZones(user)`
- `canViewCleaningReports(user)`

## После Этого

1. Replace direct `role === "cleaner"` checks with helpers.
2. Update server/KV/session policies so `worker + cleaningAccess` can write required cleaning records.
3. Stop creating new `cleaner` users; create workers with cleaning access.
4. Add `userGroups` model for organizational memberships:
   - `ועדת בטיחות`
   - `צוות חירום`
   - `נאמני בטיחות`
   - QA / leadership / observer groups
5. Add controls core model:
   - Program
   - Assignment
   - Run
   - Finding
   - Action route
6. Build first small vertical slice:
   - manual safety/control walk;
   - one location target;
   - one finding;
   - route to report-only or `מטלות`.

## What Not To Do Yet

- Do not start broad monolith split.
- Do not build full scheduling engine before first real scenario.
- Do not start QA scoring, CAPA, client SLA, or executive BI in the first slice.
- Do not migrate cleaning rounds/QR/compliance while building the first controls models.
- Do not silently clean Supabase data without an explicit owner request.

## Strategy In One Sentence

Finish the access/model foundations first, then build one narrow working `בקרות` slice, then expand scheduling/domains/dashboard only after the core flow proves itself.
