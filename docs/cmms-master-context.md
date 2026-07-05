# CMMS CDSL — Master Context Document

> **Назначение:** Этот документ — полный контекст системы для новой сессии Claude/Codex.  
> Читай его перед любой работой с проектом. После прочтения у тебя будет всё что нужно.  
> Дополняется по мере развития системы. **Дата последнего обновления: 2026-07-05.**

---

## ЧАСТЬ 1 — БЫСТРЫЙ СТАРТ (ПРОМТ ДЛЯ НОВОЙ СЕССИИ)

Вставь это в новую сессию Claude/Codex:

```text
Continue CMMS CDSL.

Source of truth: https://github.com/demzykster/facility-maintenance-system
Staging: https://facility-maintenance-system.vercel.app/

First sync:
  git fetch origin --prune
  git status --short --branch
  git log --oneline --decorate -5 origin/main
  gh pr list --state open --json number,title,isDraft,headRefName

Then read in order:
  1. docs/active-work.md       ← current state, last PRs, next action
  2. docs/handoff-for-next-codex.md  ← rules, guardrails, prompt template
  3. docs/cmms-master-context.md     ← this file: full system knowledge

Read extra docs only if task needs them:
  - docs/permissions-model.md          for users/roles/access/auth
  - docs/module-growth-architecture.md for new modules, monolith boundaries
  - docs/controls-module-design.md     for בקרות, cleaning controls, quality
  - docs/settings-site-map.md          for settings screen ownership

Rules (non-negotiable):
  - GitHub/main wins over chat memory
  - Do NOT clear/reseed/overwrite Supabase data unless owner explicitly asks
  - Do NOT start broad monolith split
  - Do NOT replace ClaudeMaintenanceApp.jsx as whole file
  - Work in small branches and PRs
  - Run: npm test -- --run && npm run build after every code change
```

---

## ЧАСТЬ 2 — СИСТЕМА: ЧТО ЭТО

**CMMS CDSL** — система управления техническим обслуживанием и операциями для логистического склада в Израиле (TPL/3PL). Интерфейс полностью на иврите, RTL.

**Пользователи системы:**
- `admin` — полный доступ, системный администратор
- `user` (manager/department manager) — управление зоной ответственности
- `tech` — техник, принимает и закрывает заявки на обслуживание
- `worker` — рабочий склада, может подать заявку, работать с уборкой/СИЗ
- `cleaner` — устаревшая роль, переходит в `worker + cleaningAccess`

**Контекст:** ~695 PR истории разработки. Многие архитектурные решения уже приняты и зафиксированы в docs. Не открывай закрытые вопросы без явного запроса владельца.

---

## ЧАСТЬ 3 — СТЕК И ИНФРАСТРУКТУРА

| Слой | Технология |
|------|-----------|
| Frontend | Vite + React SPA, один монолит `src/ClaudeMaintenanceApp.jsx` (~11 000 строк) |
| Деплой | Vercel (serverless functions в `api/` → handlers в `server/`) |
| База данных | Supabase Postgres (таблица `cmms_kv_records` как KV-мост + `app_users` + `file_metadata` + `audit_events`) |
| Auth | Supabase Auth (email-пользователи) + CMMS JWT-токен (worker/cleaner PIN) |
| Файлы | Supabase Storage |
| Пуш-уведомления | Web Push (PWA) |
| CSS | CSS-in-JS в конце монолита (`<Style>` компонент, ~1200 строк) |

**Ключевая архитектурная деталь:** `cmms_kv_records` — это временный KV-мост для v1. Не финальная схема. Каждая запись: `{scope, record_key, value (JSON string)}`. Пагинация по 1000 записей реализована в `server/kv/supabaseDriver.js`.

---

## ЧАСТЬ 4 — КАРТА ФАЙЛОВ

### src/ — бизнес-логика (модели)

| Файл | Роль |
|------|------|
| `ClaudeMaintenanceApp.jsx` | Монолит UI (~11 000 строк). Весь React. Не заменять целиком. |
| `main.jsx` | Точка входа |
| `slaModel.js` | Чистые SLA-функции: `pausedMs`, `operationalElapsedMs`, `operationalRemainingMs`, `missedOperationalSla` |
| `controlsCoreModel.js` | Domain-модель Controls: нормализация Program/Assignment/Run/Finding, CONTROL_DOMAINS, CONTROL_ACTION_ROUTE_TYPES, presets, `controlSignalEnvelope` |
| `permissionModel.js` | `PERM_LEVELS`, `USER_PERMISSION_MODULES`, `permLevel`, `hasPermission`, `canView/canRequest/canManage/canFull` |
| `ticketTransitionModel.js` | `applyTicketStatusTiming` — накопление времени по статусам |
| `notificationModel.js` | `NOTIFICATION_KIND_IDS` — 13 видов: new/confirm/back/ready/escalate/sla/task/doc/pm/upd/driver/ppe/cleaning |
| `cleaningAccessModel.js` | `normalizeCleaningAccess(user)` — резолвинг cleaning-прав из role/cleaningAccess/groups/dept |
| `locationModel.js` | `LOCATION_TYPES`, адаптеры legacy zones → location, `locationFromLegacyZoneName`, `baseLocationFromCleaningZone`, `cleaningProfileFromZone` |
| `userGroupModel.js` | `normalizeUserGroup`, `normalizeUserGroupMemberships`, `groupAudienceIds`, `visibleGroupIdsForUser` |
| `dataCollections.js` | `DATA_COLLECTIONS` — единый реестр всех KV-коллекций с prefix и future table |
| `aiProviderModel.js` | `aiModeFromEnv` — `client` → `disabled` (browser AI запрещён в prod) |
| `aiIntakeModel.js` | AI-intake контракт (draft-only, не пишет в KV напрямую) |
| `backupModel.js` | `BACKUP_COLLECTIONS` — что входит в экспорт/импорт |
| `ppeModel.js` | PPE бизнес-логика |
| `fleetMaintenancePolicyModel.js` | PM-политики по типам техники |
| `inspectionProgramModel.js` | Инспекционные программы по типам техники |
| `ticketTransitionModel.js` | Переходы статусов тикета с timing |
| `ticketDuplicateModel.js` | `transportDuplicateReview` — проверка дублей транспортных заявок |
| `ticketLifecycleExportModel.js` | Экспорт lifecycle в Excel |
| `workerAccessModel.js` | Хелперы первого входа, `workerLoginStateText` |
| `technicianToleranceModel.js` | Персональные допуски опоздания/уходаTech |
| `supplierActivityModel.js` | Активность поставщиков |

### server/ — serverless handlers

| Файл | Роль |
|------|------|
| `server/kv/supabaseDriver.js` | KV-драйвер: get/set/delete/list/listValues с пагинацией (PAGE_SIZE=1000) |
| `server/kv/upstashDriver.js` | Альтернативный KV-драйвер (Upstash) |
| `server/kv/handler.js` | HTTP-хендлер `/api/kv/[key]` — с permission-check |
| `server/kv/permissionPolicy.js` | `kvWritePermissionForKey`, `sessionHasKvWritePermission`, `redactUserSecrets` — серверная enforcement прав |
| `server/session/sessionHandler.js` | `/api/session/me` — двойной auth: Supabase JWT или CMMS PIN-токен |
| `server/session/loginHandler.js` | `/api/session/login` — вход через Supabase |
| `server/session/cmmsSessionToken.js` | Подпись/верификация CMMS JWT для worker/cleaner |
| `server/session/authCookie.js` | HttpOnly cookie для session |
| `server/audit/supabaseAuditDriver.js` | Запись audit events в Supabase |
| `server/files/handler.js` | `/api/files` — загрузка файлов в Supabase Storage |
| `server/ai/intakeHandler.js` | `/api/ai/intake` — AI intake endpoint (без реального AI-вызова в v1) |
| `server/push/handler.js` | `/api/push` — web push уведомления |
| `server/public/zonesHandler.js` | `/api/public/zones` — публичный список зон (без auth, для QR) |
| `server/public/complaintsHandler.js` | `/api/public/complaints` — анонимные жалобы через QR |

### docs/ — проектная документация

| Файл | Назначение |
|------|-----------|
| `active-work.md` | **Читать первым.** Текущий статус, последние PR, следующий шаг |
| `handoff-for-next-codex.md` | Правила для новой сессии, промт |
| `cmms-master-context.md` | **Этот файл** |
| `backlog.md` | Группированный список задач по областям |
| `permissions-model.md` | Модель прав: роли, модули, уровни |
| `module-growth-architecture.md` | Как добавлять новые модули без дублирования |
| `controls-module-design.md` | Дизайн בקרות: Program→Assignment→Run→Finding, домены, quality |
| `controls-product-blueprint-ru.md` | Продуктовое ТЗ בקרות (на русском) |
| `near-term-controls-strategy-ru.md` | Краткий план следующего шага בקרות |
| `settings-site-map.md` | Какие настройки куда принадлежат |
| `notification-matrix.md` | Матрица уведомлений по ролям (R3 контракт) |
| `locations-model-plan.md` | 4-фазный план миграции к унифицированной location-модели |
| `production-data-model.md` | Маппинг KV-prefix → future Postgres table |
| `system-audit-2026-07-05.md` | Детальный аудит системы (написан 2026-07-05) |
| `hygiene-audit-2026-07-05.md` | Аудит гигиены кода |
| `legacy-compatibility-inventory-2026-07-05.md` | Инвентаризация legacy-совместимости |

---

## ЧАСТЬ 5 — МОДЕЛЬ ДАННЫХ

### Все KV-коллекции (источник: `src/dataCollections.js`)

| Backup key | KV prefix | Future Postgres table |
|-----------|-----------|----------------------|
| `users` | `user:` | `app_users` |
| `fleet` | `fleet:` | `fleet_units` |
| `tickets` | `ticket:` | `tickets` |
| `pm` | `pm:` | `periodic_maintenance` |
| `insp` | `insp:` | `fleet_inspections` |
| `templates` | `itpl:` | `inspection_templates` |
| `presence` | `presence:` | `technician_presence` |
| `zones` | `czone:` | `cleaning_zones` |
| `rounds` | `cround:` | `cleaning_rounds` |
| `complaints` | `ccomplaint:` | `cleaning_complaints` |
| `absences` | `cabsence:` | `worker_absences` |
| `locations` | `location:` | `locations` |
| `tasks` | `mtask:` | `maintenance_tasks` |
| `meetings` | `mmeet:` | `maintenance_meetings` |
| `controlPrograms` | `controlProgram:` | `control_programs` |
| `controlAssignments` | `controlAssignment:` | `control_assignments` |
| `controlRuns` | `controlRun:` | `control_runs` |
| `controlFindings` | `controlFinding:` | `control_findings` |
| `ppe` | `ppe:` | `ppe_movements` |
| `ppeItems` | `ppeitem:` | `ppe_items` |
| `ppeNorms` | `ppenorm:` | `ppe_norms` |
| `ppeReqs` | `ppereq:` | `ppe_requests` |
| `ppeOrders` | `ppeorder:` | `ppe_orders` |
| `appIssues` | `appIssue:` | `app_issue_reports` |

Не в backup (системные): `config:v1`, `session:v1`, `theme:v1`, `login:v1`, notification prefs.

Staging stats (2026-07-02): `app_users=6`, `cmms_kv_records=228`, `fleet=126`, `mtask=88`, `user=2`.

---

## ЧАСТЬ 6 — AUTH И СЕССИИ

Система использует **два auth-пути** одновременно:

### Путь 1 — Supabase JWT (admin/user/tech)
1. Логин через `POST /api/session/login` → Supabase Auth → токен в HttpOnly cookie
2. `GET /api/session/me` → читает cookie → вызывает Supabase `/auth/v1/user` → затем `app_users` таблицу
3. Профиль нормализуется через `normalizeSupabaseAppUserProfile`
4. Сессия содержит: `id, authUserId, email, role, name, departments, permissions, mgrZones, techScope`

### Путь 2 — CMMS PIN-токен (worker/cleaner)
1. Worker вводит worker number → система не генерирует пароль/PIN заранее
2. Первый вход: `initial_secret_already_configured === false` → форма создания PIN
3. Повторный вход: `POST /api/session/login` → проверка PIN → CMMS JWT подписывается `CMMS_SESSION_SECRET`
4. `GET /api/session/me` → `verifyCmmsSessionToken` → поиск в `user:*` KV-записях
5. **ВАЖНО:** `CMMS_SESSION_SECRET` обязателен в Vercel Production

### `normalizeAuthExpiresAt`
Supabase возвращает `expires_at` в секундах → умножить на 1000 для JS timestamp.

---

## ЧАСТЬ 7 — МОДЕЛЬ ПРАВ

### Роли (role)
`admin` > `user` (manager) > `tech` > `worker` > `cleaner` (deprecated)

Admin всегда получает `full` на всё. Остальные — через explicit `perms` + role defaults.

### Уровни (PERM_LEVELS)
`none` → `view` → `request` → `manage` → `full`

### Модули (USER_PERMISSION_MODULES) — 12 штук
| Модуль | Что значит `manage` |
|--------|---------------------|
| `fleetDocs` | Видеть документы техники своей зоны |
| `fleetTickets` | Видеть историю заявок на технику |
| `ppe` | `manage` = обработка запросов; `full` = каталог, выдача, отчёты |
| `workerAccess` | Управление логином/PIN рабочих |
| `users` | `view` = чтение; `manage` = создание/редактирование |
| `userGroups` | Организационные группы |
| `controls` | `request` = выполнение; `manage` = программы/назначения; `full` = будущее |
| `analytics` | Просмотр аналитики |
| `suppliers` | Поставщики |
| `settings` | `manage` = обычные настройки; `full` = backup/restore |
| `audit` | Журнал активности |

### Server-side enforcement
`server/kv/permissionPolicy.js` → `sessionHasKvWritePermission(session, key)` — проверяет каждую запись в KV перед записью.

---

## ЧАСТЬ 8 — МОДУЛИ СИСТЕМЫ

### 8.1 Тикеты (קריאות שירות)

**Жизненный цикл:**
`new` → `in_progress` → `waiting` → `pending_user/pending_admin/pending_manager` → `done/cancelled/rework`

**Ball model — `ballIn(ticket)`:**
Кто сейчас должен действовать: `admin` / `manager` / `tech` / `none`
- `new` → admin
- `in_progress` → tech
- `pending_user` → user (manager)
- `pending_admin` → admin
- `pending_manager` → manager
- `waiting` → none (система ждёт)
- `done/cancelled` → none

**SLA — `pausePatch(prev, patch, cfg, now)`:**
Паузы (статус `waiting`) не считаются в SLA. Накапливаются: `pauseAccumMs` + активная `pauseSince`.

`operationalElapsedMs = (now - createdAt) - pausedMs`

**Ожидание без оборудования (`waiting:no_equipment`):**
Системно заблокировано — только admin может установить. `ball` = admin, `slaEffect: "pause"`.

**Lifecycle stages — `normalizedTicketLifecycleStages()`:**
Возвращает массив стадий с: key, kind, reason, label, duration, isCurrent, owner, slaAccounting.
Используется везде: dashboard, analytics, export.

**Risk scoring — `computeRisk(ticket, fleet, config)`:**
0–10+, → green/yellow/orange/red. Учитывает: тип, SLA-превышение, категорию, оборудование.

**Asset health — `assetHealth(f, tickets, insp, config)`:**
Оценка 0–100 для единицы техники.

**Visibility — `visibleTickets(session, tickets, fleet)`:**
Роль-based фильтрация. Tech видит только свои заявки или открытые.

**Duplicate check:** Для транспортных заявок → `transportDuplicateReview` перед созданием.

**AI suggest:** `aiSuggest()` → `callClaude()` — заблокировано в prod (`BROWSER_AI_ENABLED=false`).

---

### 8.2 Парк техники (כלי שינוע / Fleet)

**Каталог техники:** `fleet:*` KV. Поля: id, fleetNo, type (`סוג כלי`), model (`דגם`), supplier, driverId, documents, status.

**ВАЖНО:** `סוג כלי` (vehicle type) и `דגם` (model) — НИКОГДА не объединять в одно поле. Это архитектурный инвариант.

**PM (Периодическое обслуживание):**
- Правила: `config.maintenanceRules` → PM по типам техники
- Записи: `pm:*` KV
- Генерация: распределение по дням с `dailyCapacity`, учёт выходных, весовая система (вес 2 = тяжёлая задача)
- `nextDue` сохраняется при перераспределении

**Инспекции (ВНИМАНИЕ — два параллельных потока):**

*Поток 1 — старый `InspectionsModule`:*
- Шаблоны: `itpl:*` (UI удалён в PR #595, данные read-only)
- Результаты: `insp:*`
- Dashboard: `inspDue` → ссылка на fleet-вкладку

*Поток 2 — новый ControlsHub "בקרת כלים":*
- Показывает `fleetInspectionPlan` (вычисляется из типов + insp-записей)
- Результаты: `controlRun:*` + `controlFinding:*`

**Архитектурная проблема:** Пользователь может пройти инспекцию обоими путями → разные записи в разных коллекциях. Dashboard ссылается на старый путь. Это известный gap, пока не решён.

---

### 8.3 Уборка (ניקיון)

**Operational layer (для уборщиков) — complete:**
- Зоны: `czone:*` — объект с id, name, building, floor, windows, checklist, QR-code, cleaner assignment, compliancePolicy
- Раунды: `cround:*` — каждый раунд уборщика
- Жалобы: `ccomplaint:*` — от жителей/пользователей через QR
- QR-система: `cleaningQrModel.js`, URL-токены, jsQR-камера, физический fallback

**Cleaning Access Model (`src/cleaningAccessModel.js`):**
Resolves cleaning capabilities из многих источников:
1. legacy `role === "cleaner"`
2. `cleaningAccess` объект на user
3. `canClean` флаг
4. groups (CLEANING_GROUP_IDS)
5. department (CLEANING_DEPARTMENT_NAMES)

Возвращает: `{ enabled, canPerformRounds, canReceiveComplaints, canCloseComplaints, canManageCleaningZones, canViewCleaningReports, zoneIds, source }`

**Management layer — не реализован:**
Менеджер не имеет инструментов поверх операционного cleaning. Это следующий шаг в `בקרות → ניקיון`.

**Публичные endpoints (без auth):**
- `GET /api/public/zones` — для QR-экрана
- `POST /api/public/complaints` — анонимные жалобы (с throttling по зоне)

---

### 8.4 СИЗ (ביגוד עובדים / PPE)

**Полная цепочка:**
Каталог (`ppeitem:*`) → Нормы (`ppenorm:*`) → Дефицит → Запросы (`ppereq:*`) → Заказы (`ppeorder:*`) → Выдача (`ppe:*`) → Аналитика

**Известный gap:** Частичный сбой при выдаче — сток уменьшается до сохранения PPE-записи.

**PpeExitSettlement:** При архивировании работника — расчёт по СИЗ.

---

### 8.5 Контроль (בקרות)

**Концептуальный flow:**
`Program` → `Assignment` → `Run` → `Finding` → `Action Route` → Follow-up

**Domain-модель (src/controlsCoreModel.js):**

CONTROL_DOMAINS: `safety, quality, operations, fleet, cleaning, executive_walk, maintenance, general`

CONTROL_ACTION_ROUTE_TYPES: `report_only, task, ticket, notify, follow_up, training, capa`

CONTROL_FINDING_SEVERITIES: `info, low, medium, high, critical`

CONTROL_FINDING_STATUSES: `open, triage, routed, in_progress, closed, dismissed`

**Manual presets (4 штуки):**
- `safety-walk-basic` (safety) → route: report_only
- `fleet-yard-check` (fleet) → route: task
- `quality-returns-sample` (quality) → route: report_only
- `operations-executive-walk` (operations) → route: report_only

**Что реализовано:**
- [x] Модель Program/Assignment/Run/Finding с нормализацией
- [x] Manual presets
- [x] KV storage: `controlProgram:*`, `controlAssignment:*`, `controlRun:*`, `controlFinding:*`
- [x] UI: создание программы, назначения, запуск run, запись finding
- [x] Fleet targets: `target.kind = "fleet"` + `fleetId`
- [x] Finding → task routing (через controlFindingTaskDraft)
- [x] Linked task opens from finding history
- [x] Permissions: `controls:view/request/manage/full`

**Что НЕ реализовано:**
- Scheduling engine (assignments с датой — это ручные записи)
- Cleaning controls domain в ControlsHub
- Dashboard/insights signals из controls
- Action routes: ticket, notify, follow_up, training, capa (только report_only + task реально работают в UI)
- Executive dashboard
- Quality domain (большой, требует отдельного планирования)

**Критическая UX-проблема:** ControlsHub открывается на пустой форме (tab="run"). Stat strip показывает состояние пустой формы. Пользователь не понимает "что мне делать здесь?". Нужен operational overview как landing screen.

**Следующий шаг (согласован):** `בקרות → ניקיון` — read-only cleaning overview + manual manager quality check для зоны. Без изменения QR/round/compliance, без миграции cleaning zones.

---

### 8.6 Задачи (מטלות)

**Shared action layer** — задачи, которые могут прийти из любого модуля.

**Source links (уже в модели):**
`sourceModule`, `sourceFindingId`, `sourceControlRunId`, `sourceProgramId`

**Что работает:** создание, фильтры, bulk select, bulk delete, status updates.

**Что не работает:**
- В task row нет source badge (откуда пришла задача)
- Нет фильтра по sourceModule
- Workers не в KV write rules для `mtask:*`

---

### 8.7 Dashboard и аналитика

**Dashboard:** stats (тикеты/SLA/PM), ticket cards с risk badges, инспекции к выполнению, pending PPE requests.

**Insights Hub (аналитика):** charts по тикетам, SLA, fleet, cleaning analytics. `computeInsights()`.

**Что отсутствует:** Cross-module сигналы. Controls findings, overdue assignments, cleaning alerts — не попадают на dashboard. `computeInsights` не читает `controlRun:*` или `controlFinding:*`.

**Dashboard signal envelope** (из controlSignalEnvelope):
`{ severity, status, assignedTo, dueAt, sourceModule, sourceId }` — контракт для будущего attention layer.

---

### 8.8 Настройки (הגדרות)

**Принцип ownership (docs/settings-site-map.md):**
- Типы техники → Fleet settings tab
- Статусы задач → Tasks settings tab
- Отделы и смены → Teams/Users
- Global: SLA, wait reasons, downtime levels, critical escalation hours, brand config, backup/restore

**Ещё не перенесено:** `קיבולת טיפולים יומית` (PM daily capacity) всё ещё в global settings.

---

### 8.9 Пользователи и права

**UserTree:** иерархия пользователей с архивными записями по месяцу увольнения.

**UserForm — ключевые правила:**
- Cleaner → нормализуется в worker
- `cleaningAccess` хранится только если пользователь НЕ в cleaning dept (иначе автоматически)
- Facility tech требует ≥1 techCats
- Manager получает `mgrZones` (ответственные зоны)
- Проверки: уникальность email, уникальность workerNo

**ActivationControls:** Новый пользователь создаётся без пароля/PIN. Первый вход по email или worker number → форма создания пароля/PIN.

**ProfileModal:** `canEditEmail` — исключает роли tech/worker.

---

## ЧАСТЬ 9 — КЛЮЧЕВЫЕ НЮАНСЫ БИЗНЕС-ЛОГИКИ

### Pause SLA accounting
```js
pausedMs(ticket, now) = pauseAccumMs + (pauseSince ? now - pauseSince : 0)
operationalElapsedMs(ticket, at) = (at - createdAt) - pausedMs(ticket, at)
operationalSlaMs(ticket) = dueAt - createdAt
isOperationallyOverdue = operationalRemainingMs < 0 && status !== "done/cancelled"
```

### Ball model
`ballIn(ticket)`: кому мяч (чья очередь действовать). Используется для:
- dashboard warnings (у кого зависший мяч)
- notification routing
- lifecycle stage owner

**Известный gap:** ballIn не знает о rework-потоке.

### Ticket timing накопление
`applyTicketStatusTiming(nextTicket, previousTicket, now)`:
При смене статуса — накапливает время предыдущего статуса в `statusMs[statusKey]`. `statusSince` = когда начался текущий статус.

### cleaningAccessModel resolution order
1. `role === "cleaner"` (legacy) → все cleaning права
2. `cleaningAccess.enabled === true` → из объекта
3. `canClean === true` → базовые права
4. `groups` содержит CLEANING_GROUP_ID → enabled
5. `dept/depts` содержит cleaning dept name → enabled

### Worker PIN session lookup
`GET /api/session/me` → token → `verifyCmmsSessionToken(token, CMMS_SESSION_SECRET)` → читает все `user:*` записи → ищет по id/workerNo совпадение.

### AI mode в production
`aiModeFromEnv`: если `VITE_CMMS_AI_MODE === "client"` → принудительно `disabled`. В production AI не работает.

---

## ЧАСТЬ 10 — LOCATION MODEL (3 системы в переходе)

**Текущее состояние — 3 параллельные системы:**
1. `config.zones` — массив строк, зоны технического обслуживания
2. `czone:*` — объекты уборочных зон
3. `location:*` — новая унифицированная модель (KV зарезервирован в PR #680)

**`src/locationModel.js` существует, но НИКТО ЕГО НЕ ИСПОЛЬЗУЕТ.** Модель написана, адаптеры написаны (`locationFromLegacyZoneName`, `baseLocationFromCleaningZone`), данные не мигрированы.

**Правила миграции (docs/locations-model-plan.md):**
- Phase 1: model + adapters only — DONE
- Phase 2: controls может использовать locationId
- Phase 3: cleaning zones получают locationId
- Phase 4: config.zones deprecate
- **НЕ мигрировать cleaning zones пока Controls не стабилен**

---

## ЧАСТЬ 11 — ИЗВЕСТНЫЕ GAPS И ПРОБЛЕМЫ

**Критические:**
1. ControlsHub открывается на пустой форме вместо operational overview
2. Dual fleet inspection flows → данные расходятся между insp:* и controlRun:*
3. Dashboard blind to controls data
4. AI полностью отключён в production

**Функциональные:**
5. Controls finding routes: UI имеет только report_only + task (из 7 типов)
6. ballIn не знает о rework-потоке
7. Cleaning management layer отсутствует (только operational)
8. мТалот: нет source badge в UI, workers не в KV write rules
9. Budget: `estimatedFutureCost: null` — placeholder
10. ProfileModal.canEditEmail исключает tech/worker

**Архитектурные:**
11. N+1 writes: ZoneForm, SettingsPanel dept rename, SupplierDetail rename — все итерируют и пишут по одной записи
12. Checklist в ControlsHub: slice(0, 8) молча обрезает (нет предупреждения)
13. recentRuns.slice(0, 6) — history только 6 последних
14. 27 useState в ControlsHub (монолит внутри монолита)
15. SettingsPanel гейтируется canManageSettings (не через permissionModel)

**Developer copy в production UI:**
16. "עדיין בלי מנוע שיבוץ אוטומטי..." — developer note видна пользователям
17. "זהו סבב ראשון צר..." — то же самое

---

## ЧАСТЬ 12 — АРХИТЕКТУРНЫЕ ПРАВИЛА (НЕ НАРУШАТЬ)

### Что НЕЛЬЗЯ делать

- **Не заменять `src/ClaudeMaintenanceApp.jsx` целиком** (только точечные правки)
- **Не начинать broad monolith split** (только после стабилизации data layer, с явного запроса владельца)
- **Не очищать/пересеивать Supabase данные** без явного запроса владельца
- **Не возрождать очищенные appIssue reports** или старые формулировки TO/fleet task
- **Не объединять `סוג כלי` и `דגם`** в одно поле
- **Не создавать третью модель зон** (только конвергировать в locations)
- **Не добавлять модуль без ответов на вопросы** из `docs/module-growth-architecture.md`
- **Не писать в KV напрямую из AI** — только через product operations с validation/auth/audit
- **Browser AI calls (`client` mode) запрещены в production**
- **Не добавлять новый правый sidebar item** для cleaning controls (это domain внутри בקרות)

### Что НУЖНО делать

- Работать маленькими PR (≤100 строк diff где возможно)
- `npm test -- --run && npm run build` после каждого изменения кода
- `git fetch origin --prune` перед началом работы
- `docs/active-work.md` обновлять только при: смене стратегии, паузе с незамерженной веткой, блокере
- `docs/backlog.md` обновлять только при: открытии/закрытии/репрайоритизации задачи
- Объяснять изменения простым языком

---

## ЧАСТЬ 13 — ТЕКУЩЕЕ СОСТОЯНИЕ И СЛЕДУЮЩИЕ ШАГИ

### Состояние на 2026-07-05

- **Последний PR:** #695 — hygiene cleanup (browser alerts → toasts, нейтральные примеры, legacy inventory)
- **Активная ветка:** нет
- **Открытые PR:** нет
- **Staging данные:** живые, защищены (126 fleet, 88 tasks, 6 users)

### Что готово для пилота

- Tickets (полный flow, SLA, lifecycle export) ✅
- Fleet (карточки, PM, документы, инспекции старым путём) ✅
- Cleaning operational (зоны, QR, раунды, жалобы) ✅
- PPE (полная цепочка) ✅
- Tasks (создание, bulk, source links в модели) ✅
- Auth/Session (Supabase + CMMS JWT) ✅
- Push notifications (PWA) ✅
- Backup/Restore ✅

### Что не готово для пилота

- Controls (работает технически, но UX proof-of-concept, не продукт)
- Cleaning management layer (отсутствует)
- AI (отключён)
- Budget (placeholder)

### Согласованный следующий шаг

**`בקרות → ניקיון`:** read-only cleaning overview для менеджера/admin внутри ControlsHub + manual quality check для зоны. Без QR/round/compliance изменений. Без миграции zones. Без нового sidebar item.

**Приоритет 0 перед этим:** исправить entry experience ControlsHub — сменить default tab с "run" на operational overview.

---

## ЧАСТЬ 14 — ПРИОРИТЕТЫ ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ

В порядке важности:

1. **Исправить вход в ControlsHub** — default tab → overview screen с состоянием системы
2. **Cleaning controls в בקרות** — read-only overview + manual quality check
3. **Source badge в מטלות** — показывать откуда пришла задача (בקרות/ניקיון/קריאה)
4. **Убрать developer copy** — "עדיין בלי מנוע שיבוץ" и подобное
5. **Решить dual fleet inspection track** — либо redirect, либо явное разделение

**НЕ делать:**
- Scheduling engine
- Quality domain (большой)
- Executive dashboard
- Locations migration
- Monolith split

---

*Документ создан на основе полного чтения: монолит 11 018 строк + 67 src-файлов + server/ + 30+ docs. Версия 2026-07-05.*
