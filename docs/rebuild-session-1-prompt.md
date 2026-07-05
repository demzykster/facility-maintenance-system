# Промт для Session 1 — CMMS v2 Rebuild

> Скопируй весь текст из блока ниже и вставь в новую сессию Claude/Codex.

---

```
CMMS v2 Rebuild — Session 1.

Repo: https://github.com/demzykster/facility-maintenance-system
Branch: v2
Existing production (DO NOT TOUCH): https://facility-maintenance-system.vercel.app/

═══════════════════════════════════════
КОНТЕКСТ — читай в этом порядке:
═══════════════════════════════════════

1. docs/cmms-master-context.md   ← полное знание системы
2. docs/rebuild-log.md           ← статус rebuild, что сделано, что следующее

═══════════════════════════════════════
АРХИТЕКТУРА v2
═══════════════════════════════════════

Мы переписываем src/ClaudeMaintenanceApp.jsx (11 000 строк монолит)
в нормальную feature-based структуру.

НЕ ТРОГАТЬ:
- server/          все serverless handlers — хорошие, оставить
- src/*.js         все 67 файлов бизнес-логики — чистые, оставить
- docs/            вся документация
- public/, package.json, .env*, Vercel/Supabase конфиг

СОЗДАТЬ:
src/
  app/              router, auth, app shell, layout, theme
  features/
    tickets/        קריאות שירות
    fleet/          כלי שינוע + PM + inspections
    cleaning/       ניקיון operational + management
    controls/       בקרות (переделать правильно)
    ppe/            ביגוד עובדים
    tasks/          מטלות + meetings
    dashboard/      attention layer + analytics
    settings/       настройки по владельцам
    users/          users + permissions
  shared/
    components/     reusable UI
    hooks/          shared hooks
    ui/             design system

Папки уже созданы в репо. Начинай писать файлы.

═══════════════════════════════════════
ПРОТОКОЛ СЕССИИ — ВАЖНО
═══════════════════════════════════════

Следи за этими триггерами и сигнализируй сам:

СТОП если:
- Написал feature-модуль полностью
- Сессия идёт >40 сообщений
- Заметил несоответствие с кодом написанным раньше в этой сессии
- Принимается решение которое влияет на несколько модулей

Когда СТОП:
1. Обнови docs/rebuild-log.md (что сделано, решения, следующий target)
2. Выведи точный промт для следующей сессии в формате:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ВРЕМЯ НОВОЙ СЕССИИ

Сделано: [список файлов/компонентов]
Следующая сессия: [target]

ПРОМТ — скопируй целиком:
[готовый промт]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════
ЗАДАЧА ЭТОЙ СЕССИИ: src/app/
═══════════════════════════════════════

Напиши фундамент приложения полностью:

** src/app/router.jsx **
- React Router (или аналог)
- Все маршруты: /login, /dashboard, /tickets, /fleet, /cleaning, 
  /controls, /ppe, /tasks, /users, /settings, /profile
- Защищённые маршруты (redirect на /login если нет сессии)
- Role-based routes (tech не видит /users, worker видит ограниченно)

** src/app/auth.jsx (AuthContext) **
- Загружает сессию с GET /api/session/me
- Хранит: { user, role, permissions, loading, error }
- Поддерживает оба auth-пути:
  * Supabase JWT (admin/user/tech) — токен в cookie
  * CMMS PIN токен (worker/cleaner) — CMMS_SESSION_SECRET
- logout() — вызывает POST /api/session/logout
- Автообновление сессии

** src/app/layout.jsx **
- Desktop (≥980px): левый sidebar + контент
- Mobile (<980px): топбар + контент + нижняя навигация (4 таба + More)
- RTL (dir="rtl", lang="he")
- Sidebar: роль-зависимая навигация
- Топбар: имя пользователя, уведомления, профиль
- Нижний nav (mobile): основные разделы по роли

** src/app/navigation.js **
- Конфигурация навигации по ролям
- admin: всё
- user (manager): tickets, fleet, cleaning, controls, ppe, tasks, dashboard
- tech: tickets (только свои), fleet (read), presence
- worker: tickets (submit), cleaning (если cleaningAccess), ppe (request)

** src/shared/ui/ — design system **
- CSS переменные (light/dark theme)
- Базовые компоненты: Button, Card, Badge, Modal, Toast, Spinner
- RTL-совместимость везде
- Breakpoints: 390, 720, 980, 1300px
- Цвета: primary, success, warning, danger, neutral

** src/app/index.jsx (entry point) **
- Заменяет src/main.jsx
- Подключает AuthProvider, Router, Theme

ТРЕБОВАНИЯ:
- Иврит RTL везде
- Mobile-first (PWA)
- Тёмная/светлая тема через CSS переменные (.app-dark)
- НЕ начинать features/ — только app/ и shared/ui/
- Импортировать готовые модели из src/*.js (permissionModel, notificationModel и т.д.)
- Не дублировать бизнес-логику которая уже есть в src/*.js

Когда src/app/ написан полностью — сигнализируй 🔴 СТОП.
```

---

## После Session 1

Когда Claude выдаст сигнал 🔴, он сам напишет промт для Session 2.  
Промт будет про `src/features/tickets/`.

Обнови этот файл (или создай `rebuild-session-2-prompt.md`) с тем что Claude написал.
