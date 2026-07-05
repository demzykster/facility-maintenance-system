# System Audit — CMMS CDSL
**Дата:** 2026-07-05  
**Базовый коммит:** a68265f (#700)  
**Методология:** изучение всей документации + чтение кода + сравнение с концепцией

---

## Часть 1. Что система представляет собой сегодня

### Что работает и работает хорошо

Ядро системы — зрелое и функциональное:

- **Tickets (קריאות)** — полный flow: создание, статусы, SLA, lifecycle export, дубликаты, ball-holder, closure quality. Solid.
- **Cleaning (ניקיון)** — операционный слой для уборщиков работает: зоны, QR, раунды, жалобы, compliance, окна. Хорошо написан.
- **Fleet (כלי שינוע)** — карточки техники, PM, водители, документы, history. Рабочий модуль.
- **PPE (ביגוד עובדים)** — выдача, нормы, запросы, аналитика. Завершён.
- **Tasks (מטלות)** — создание, фильтры, bulk actions, source links уже есть в модели.
- **Auth/Session/KV** — Supabase + Vercel serverless, исправленный `expiresAt`, боевая инфраструктура.
- **Settings architecture** — частично реорганизовано: vehicle types → fleet, task statuses → tasks, departments → team. Правильная логика.

### Что существует как proof-of-concept, не как продукт

- **בקרות** — есть, работает технически, но UX сломан (см. Часть 2).
- **Executive dashboard** — нет. InsightsHub даёт аналитику (charts), но не attention layer.
- **Cleaning management overlay** — нет. בקרת ניקיון есть только в InsightsHub как analytics tab (CleaningAnalytics), не как management control.
- **Scheduling engine** — не реализован. Assignments создаются вручную с датой, авто-распределения нет.
- **Quality domain** — не начат.

---

## Часть 2. Аудит модуля בקרות — детально

### 2.1 Проблема входа (критическая)

**Что происходит:**  
ControlsHub открывается на табе `"run"` (первый `useState("run")`). Пользователь видит:
- Шапку с тремя счётчиками: `0/0 סעיפים שסומנו`, `0 ממצאים`, `0 טיוטת מטלה`
- Пустую форму с полями: имя проверки, домен, шаблоны, цель, чеклист, заметки, подпись
- Кнопку "סיום בדיקה"

**Что должно происходить:**  
Пользователь должен видеть *состояние системы контроля*: что назначено, что просрочено, где открытые находки, по каким доменам были последние проверки.

**Почему это проблема:**  
Счётчики в stat-strip показывают состояние текущей пустой формы — они бесполезны при входе. Пользователь не понимает "зачем я здесь" прежде чем начнёт что-то делать.

---

### 2.2 Три таба смешивают разные уровни абстракции

| Таб | Что это | Кому нужно | Как часто |
|-----|---------|-----------|-----------|
| ביצוע בדיקה | Форма выполнения проверки | Исполнитель | При выполнении |
| בקרת כלים | Список техники по типам с кнопкой "בדיקה" | Исполнитель/менеджер | Для fleet-domain |
| תכניות ושיוכים | Создание программ + управление назначениями | Менеджер/admin | Редко |

Проблема: это три разных уровня (операционный, доменный, административный) на одном уровне навигации. Менеджер, зашедший посмотреть "что происходит с контролями", попадает на форму для исполнителя.

---

### 2.3 Двойная система fleet inspections (архитектурный разрыв)

В системе одновременно существуют **два независимых flow** для проверок техники:

**Система 1 — `InspectionsModule` (старая, строки 7353–7381):**
- Хранит в `insp:*` через `saveInsp()`
- Список "лביצוע" через `buildInspectionDuePairs()`
- Попадает в InspHistory, InspDetail, InspectionRun
- На dashboard: `inspDue` → notification → ссылка на fleet → вкладку "בקרת כלים"
- **Результат**: запись в `insp:*` (старая модель)

**Система 2 — ControlsHub "בקרת כלים" таб:**
- Показывает `fleetInspectionPlan` (вычисленный по vehicle types + insp records)
- При нажатии "בדיקה" → `startFleetPlanRun()` → открывает run form в табе "ביצוע בדיקה"
- **Результат**: запись в `controlRun:*` + `controlFinding:*` (новая модель)

**Проблема:** Пользователь может выполнить fleet inspection через оба пути и получить разные records в разных коллекциях. Dashboard alerts указывают на старый путь (`go: "insp"` → fleet module). ControlsHub показывает fleet plan но истории из старой системы. **Данные расходятся.**

---

### 2.4 Finding section слишком жёстко привязана к чеклисту

Секция `ממצא ופעולת המשך` появляется только при условии `findingCount > 0` (хотя бы один item в чеклисте отмечен как "בעיה"). 

Реальные сценарии, которые это ломает:
- Инспектор хочет зафиксировать finding без формального чеклиста (ad-hoc наблюдение)
- Инспектор заполнил чеклист "всё OK", но заметил что-то в стороне
- Finding к зоне/объекту который не в чеклисте

---

### 2.5 Чеклист ограничен 8 пунктами без предупреждения пользователю

```js
const checklist = useMemo(() => 
  checklistText.split("\n").map(...).filter(Boolean).slice(0, 8), 
  [checklistText]
);
```

Пользователь вводит 12 пунктов в textarea — видит 8. Нет сообщения об ограничении. Bug-like behavior.

---

### 2.6 История похоронена в неправильном месте

Последние runs отображаются **в конце таба "ביצוע בדיקה"**, после формы, после finding section. Это значит:
- Чтобы посмотреть историю, надо прокрутить через пустую форму
- История прячется за той же формой, которая нужна для создания новой записи

---

### 2.7 Findings overview — хороший компонент, плохое место

`control-findings-overview` с фильтрами (הכל / עם מטלה / ללא מטלה / לדוח בלבד) — это хорошая идея. Но он:
- Живёт в конце таба "run", после всей формы и истории
- Показывает max 8 findings без пагинации
- Не фильтруется по домену, по серьёзности, по target

---

### 2.8 Hint text для end-users — признание незавершённости

В интерфейсе видны следующие подсказки:
- _"עדיין בלי מנוע שיבוץ אוטומטי, אבל עם תדירות..."_ — в fleet tab
- _"זהו סבב ראשון צר... מנוע תזמון, ימי העדפה... יגיעו בהמשך"_ — в programs tab
- _"בחירת תבנית מחליפה את שם הבדיקה והצ׳קליסט בלבד"_ — в run form

Это developer notes, не user copy. Пользователю не нужно знать что "engine придёт позже". Это нужно заменить нормальным ограниченным UI без объяснений.

---

## Часть 3. Противоречия между документами и кодом

| # | Что написано в docs | Что в коде |
|---|-------------------|-----------|
| 1 | "בקרות должен открываться как operational overview" | Открывается на пустой форме (tab="run") |
| 2 | "Fleet controls используют реальные fleet records" | ControlsHub — да. InspectionsModule (old) — нет, продолжает работать |
| 3 | "Cleaning controls = домен внутри בקרות" | Нет cleaning в ControlsHub. Есть CleaningAnalytics в InsightsHub |
| 4 | "Locations должны сойтись в одну модель" | locationModel.js создан, но никто его не использует. Три системы: config.zones + czone:* + locations |
| 5 | "מטלות — shared action layer" | Storage prefix: `mtask:`, table: `maintenance_tasks`. Workers не в KV write rules |
| 6 | "קיבולת טיפולים יומית нужно перенести из global settings" | Всё ещё в global settings (упомянуто в docs как "нужно перенести") |
| 7 | "Settings не должны быть свалкой" | Global הגדרות всё ещё содержит разнородные секции |
| 8 | "AI не должен быть декоративным" | AI panel есть в UI, путь к серверу настроен, но panel доступна в навигации и создаёт ожидание |

---

## Часть 4. Проблемы по другим модулям

### 4.1 Dashboard — нет attention layer

Dashboard показывает: stats (тикеты/SLA/PM), ticket cards, инспекции к выполнению, pending PPE requests. 

**Чего нет:** 
- Cross-module сигналы (открытые finding из בקרות на dashboard)  
- Повторяющиеся проблемы по зоне/технике
- Просроченные assignments из controls
- Cleaning alerts в management view (только в InsightsHub)

Dashboard — это operational board для текущего дня, не executive attention layer. Это разные вещи, и разница не отражена в UI.

---

### 4.2 מטלות — хорошая идея, незавершённая реализация

Source links (`sourceModule`, `sourceFindingId`, `sourceControlRunId`) **есть в модели** и сохраняются. Но:
- В list view нет фильтра по sourceModule
- В task row нет показа source context (откуда пришла задача)
- Нет visual distinction между "задача из finding" и "ручная задача"
- Workers всё ещё не в KV write rules для `mtask:*`

Пользователь открывает список задач и видит задачи из בקרות перемешанные с обычными — без контекста.

---

### 4.3 Cleaning — хорошо для операций, пусто для management

Operational cleaning layer (уборщик) — complete.  
Management layer (менеджер видит зоны с проблемами, создаёт finding) — **отсутствует**.

CleaningAnalytics в InsightsHub показывает графики и compliance %, но не даёт менеджеру:
- Увидеть конкретные зоны с открытыми жалобами/просрочками
- Сделать manual quality check зоны
- Создать finding → task/ticket из cleaning context

---

### 4.4 Settings — незаконченная реорганизация

Сделано хорошо: vehicle types → fleet, task statuses → tasks, departments → team.  
Ещё не сделано: PM daily capacity (`קיבולת טיפולים יומית`) — всё ещё в global settings.

Это создаёт inconsistency: часть fleet-специфичных настроек уже в fleet, часть — ещё в global.

---

## Часть 5. Технические проблемы кода

### 5.1 ClaudeMaintenanceApp.jsx — 9,242 строки, 113 функций

Включает: auth UI, dashboard, tickets, fleet, inspections, PM, cleaning, tasks, meetings, PPE, settings, AI panel, большой CSS блок. Всё в одном файле.

**ControlsHub** — ~720 строк, 27 useState, inline checklist logic, fleet plan computation, assignment management, findings overview, run history. Монолит внутри монолита.

Сложность для сопровождения: изменение в одном месте может задеть другое через общий state или shared helpers.

### 5.2 Hardcoded limits

- `recentRuns = controlRuns.slice(0, 6)` — история показывает только 6 последних runs
- `findingRows.slice(0, 24)` — findings overview без пагинации
- `NEXT_DAYS = 30` — hardcoded fallback для fleet inspection interval (строка 7446)
- Чеклист: `slice(0, 8)` — молча обрезает

### 5.3 ControlsHub: 27 useState

```
controlTab, name, domain, target, checklistText, answers, notes, signature,
findingTitle, findingDesc, severity, routeType, responsibleId, taskDue, msg, busy,
savedRun, savedFinding, openRunId, historyFilter, programDraft, assignmentDrafts,
activeAssignmentRun, activeFleetPlanRun, [+ 3 useMemo, useEffect...]
```

Весь state одного компонента. Нет разделения между "run form state", "program management state", "history view state". Сбросить только форму, не трогая остальное — сложно.

---

## Часть 6. Что в итоге получится — объективная оценка

### Сильные стороны продукта

1. Задумка правильная и достаточно уникальная — один движок контроля для safety/quality/cleaning/fleet вместо набора разных инструментов.
2. Operational cleaning layer — лучшая часть системы. Зрелый, специализированный, удобный.
3. Ticket flow с SLA lifecycle — solid, production-ready.
4. KV bridge + Supabase инфраструктура — грамотное решение для пилота.
5. Permissions model — продуманная иерархия.

### Слабые стороны

1. **בקרות не работает как продукт** — работает как форма с историей. Пользователь не понимает "что мне делать здесь?".
2. **Два fleet inspection flow** — данные расходятся, навигация запутана, dashboard указывает не туда.
3. **Нет cross-module видимости** — задачи из controls выглядят как обычные задачи, finding не попадают на dashboard.
4. **Management cleaning view отсутствует** — менеджер не имеет инструментов поверх операционного cleaning.
5. **Scheduling engine не реализован** — без него assignments это просто вручную сделанные записи с датой. "Следующий шаг" в docs требует scheduling, но его нет.

---

## Часть 7. Приоритеты (что делать в каком порядке)

### Приоритет 1 — Исправить вход в בקרות (ни строки нового функционала)
- Сменить default tab с "run" на overview screen
- Stat strip должен показывать системное состояние: сколько open findings, сколько назначений к выполнению, сколько просрочено
- Перенести findings overview вверх
- "ביצוע בדיקה" превращается в action button / sub-mode, не main tab

### Приоритет 2 — Решить двойной fleet inspection track
- **Опция A:** Redirect InspectionsModule → ControlsHub fleet tab. Данные `insp:*` остаются для read-only history.
- **Опция B:** Явно разделить: InspectionsModule = old system (до миграции), ControlsHub = новая система. Сделать dashboard ссылаться на ControlsHub.
- Без решения — система будет дублировать записи и путать пользователей.

### Приоритет 3 — Cleaning controls в בקרות
- Добавить домен "ניקיון" в ControlsHub
- Read-only overview: зоны, последние раунды, жалобы, compliance
- Manual quality check → finding → route to מטלה/קריאה
- Без изменения QR/round/compliance logic

### Приоритет 4 — Связать מטלות с источниками в UI
- В task row показывать source badge (откуда: "בקרות", "ניקיון", "קריאה")
- Фильтр по sourceModule в task list
- Это не требует изменения storage, только UI

### Приоритет 5 — Убрать developer copy из end-user UI
- "עדיין בלי מנוע שיבוץ אוטומטי..." — убрать или заменить нейтральным
- Hint texts о том что "придёт в будущем" — убрать
- Limit 8 items — либо поднять, либо показать счётчик/предупреждение

### Не делать сейчас
- Scheduling engine (без реального сценария, который прошёл Program→Assignment→Run)
- Quality domain (большой, требует отдельного планирования)
- Executive dashboard (требует сначала cross-module signal envelope)
- Locations migration (сломает cleaning QR)
- Monolith split (преждевременно)

---

## Резюме

Продукт **функционально состоятелен** для пилота в части tickets/cleaning/fleet/PPE.  
Модуль **בקרות существует**, но открывается как инструмент разработчика, а не рабочая система.  
Главная проблема не в отсутствии функций — она в том, что **вход в систему контроля не отвечает на вопрос "что мне сейчас делать?"**.  
Исправление entry experience בקרות + cleaning management slice + source context в tasks — это три изменения, которые превратят proof-of-concept в рабочий продукт без добавления большого нового функционала.
