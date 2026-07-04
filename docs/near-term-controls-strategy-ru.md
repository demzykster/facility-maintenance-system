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
- Cleaning-access foundation уже закрыт: helper/model, UI-пути, session/KV write paths, cleanup роли при создании пользователя, профильный экран уборки для cleaning worker и мобильный role-preview уже прошли через последние merged PR.
- Controls core model уже закрыт: Program, Assignment, Run, Finding, visibility, action routes, dashboard signal envelope.

## Ближайший Правильный Шаг

Сначала не строить UI `בקרות`.

Следующий безопасный блок:

```text
userGroups foundation
```

Содержание:

- держать `userGroups` как организационный слой над ролями;
- дать ему отдельный permission key (`userGroups`), а не прятать внутри `users`;
- держать group model/test работу чистой, пока маленький UI явно не открыт;
- пока без Supabase migration;
- пока без controls records;
- пока без scheduling engine.

Уже закрытые cleaning helpers:

- `isWorkerLike(user)`
- `hasCleaningAccess(user)`
- `canPerformCleaning(user)`
- `canReceiveCleaningComplaints(user)`
- `canCloseCleaningComplaints(user)`
- `canManageCleaningZones(user)`
- `canViewCleaningReports(user)`

## После Этого

1. Done: добавить/закончить `userGroups` model и permission foundation для организационных membership:
   - `ועדת בטיחות`
   - `צוות חירום`
   - `נאמני בטיחות`
   - QA / leadership / observer groups
2. Затем добавить маленький userGroups UI только когда owner одобрит этот экран:
   - create/edit group;
   - назначение lead/member/observer;
   - без scheduling и без controls run.
3. Current: добавить `controls` в общую модель прав:
   - `view` для чтения;
   - `request` как временный уровень "выполнить назначенный обход";
   - `manage` для программ/назначений/контроля исполнения;
   - `full` для будущих чувствительных настроек и отчетов.
4. Затем собрать первый маленький controls UI shell.
5. После этого собрать первый рабочий сценарий:
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
