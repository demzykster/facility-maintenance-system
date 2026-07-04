# Ближайшая Стратегия Работы

Дата: 2026-07-04.

Этот документ коротко фиксирует ближайший порядок после cleanup и первого ручного `בקרות` slice.

## Что Уже Закрыто

- Зафиксирован целевой продуктовый blueprint для `בקרות`.
- Зафиксирован аудит текущего состояния.
- Устаревшие Supabase/status docs обновлены.
- Небезопасный client-side AI path отключен.
- Legacy `שאלונים` / inspection-template authoring убран.
- `מטלות` начали становиться shared action layer: задачи сохраняют `source*` связи, а UI должен показывать контекст источника там, где эти поля уже есть.
- `locations` получили migration boundary и pure helper model.
- Решено: `cleaner` не остается долгосрочной core role. Будущая модель: `worker + cleaning access/capability`.
- Зафиксировано: текущие users/history/app data не ценны для миграции, пока owner не скажет иначе. Destructive Supabase cleanup все равно только по явной команде.
- Cleaning-access foundation уже закрыт: helper/model, UI-пути, session/KV write paths, cleanup роли при создании пользователя, профильный экран уборки для cleaning worker и мобильный role-preview уже прошли через последние merged PR.
- Controls core model уже закрыт: Program, Assignment, Run, Finding, visibility, action routes, dashboard signal envelope.
- Первый ручной `בקרות` slice уже закрыт: ручной обход, чеклист, finding, report-only или подтвержденная `מטלה`, сохранение run/finding в KV, история, и открытие связанной `מטלה`.
- Stable storage contract уже закрыт: зарезервированы `controlProgram:*`, `controlAssignment:*`, `controlRun:*`, `controlFinding:*` и будущие таблицы `control_programs`, `control_assignments`, `control_runs`, `control_findings`.
- Первый маленький domain increment уже начат: ручные `בקרות` получили легкие шаблоны для safety walk, fleet/tool check, quality sample и operations/executive walk. Эти шаблоны только заполняют название/чеклист ручного обхода; они не создают расписания, программы, назначения или новые таблицы.
- Следующий UI-мост: из ручного шаблона можно сохранить первую `Control Program`, из программы создать один ручной `Assignment`, открыть из него `Run`, сохранить `Finding` и при необходимости создать `מטלה` с source links. Это не scheduling engine, не автогенерация назначений и не broad controls dashboard.
- Fleet controls target rule: `בקרת כלים` is not a generic checklist detached from the fleet list. When the domain is `fleet`, the operator should choose a real fleet record; assignments/runs/findings preserve `target.kind = "fleet"` and `fleetId`.
- Cleaning controls decision: `בקרת ניקיון` becomes a domain inside `בקרות` for managers/admins, while cleaners keep the existing simple cleaning flow. First step is read-only overview plus manual manager quality checks for cleaning zones, not QR/round/compliance migration.
- `פגישות` / `פ.ע` согласованы как общий contextual work-event layer: обычная `פ.ע` остается default-сценарием, а встречи из `בקרות`, `מטלות`, `קריאות`, комитетов или executive walk должны получать context/source links вместо отдельной несовместимой логики.

## Ближайший Правильный Шаг

Не строить сразу большой модуль `בקרות`.

Следующий безопасный блок:

```text
first narrow domain increment
```

Содержание:

- выбрать один узкий домен: cleaning controls, safety, quality, fleet controls, или executive walk;
- не добавлять scheduling engine, пока один реальный сценарий не пройден через Program -> Assignment -> Run -> Finding -> Action;
- если это quality, держать первый slice минимальным: один QA-процесс, один finding flow, один action route;
- использовать уже зарезервированные controls collections, но не делать Supabase table migration;
- не мигрировать cleaning/location систему в том же PR;
- пока без executive BI и AI-assisted dashboard.

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
3. Done: добавить `controls` в общую модель прав:
   - `view` для чтения;
   - `request` как временный уровень "выполнить назначенный обход";
   - `manage` для программ/назначений/контроля исполнения;
   - `full` для будущих чувствительных настроек и отчетов.
4. Done: собрать первый маленький controls UI shell.
5. Done: собрать первый рабочий сценарий небольшими model/UI шагами:
   - manual safety/control walk;
   - one location target;
   - one finding;
   - route to report-only or `מטלות`.

Закрыто в первом ручном UI-slice: один ручной обход, чеклист, один finding, выбор report-only или подтвержденное создание реальной `מטלה` с `source*` связями. Completed run/finding сохраняются как shared KV `controlRun:*` / `controlFinding:*`, история показывает детали с подписью/ответами/ממצאים, а finding с созданной задачей открывает связанную `מטלה` из истории.

6. Done: зарезервировать stable storage contract для controls programs/assignments/runs/findings.
7. Done: first saved Program -> Assignment -> Run -> Finding -> Action scenario, including fleet target selection from real fleet records.
8. Next: cleaning controls domain slice. Scope: `בקרות -> ניקיון` read-only overview for managers/admins plus manual manager quality check for a cleaning zone. Без QR rewrite, без automatic complaint/finding conversion, без cleaning zone migration, без Supabase table migration и без broad dashboard.

## What Not To Do Yet

- Do not start broad monolith split.
- Do not build full scheduling engine before first real scenario.
- Do not start QA scoring, CAPA, client SLA, or executive BI in the first slice.
- Do not migrate cleaning rounds/QR/compliance while building the first controls models.
- Do not move live module settings only to clean up `הגדרות`; remove obsolete settings first, and move live settings only after their module has a stable settings surface/save handler.
- Do not silently clean Supabase data without an explicit owner request.

## Strategy In One Sentence

Finish the access/model foundations first, then build one narrow working `בקרות` slice, then expand scheduling/domains/dashboard only after the core flow proves itself.
