# Rebuild Log — CMMS v2

> Этот файл — первое что читает каждая новая сессия (после cmms-master-context.md).
> Обновляется в конце каждой сессии перед остановкой.

## Текущий статус

**Активная сессия:** не начата  
**Последнее обновление:** 2026-07-05  
**Ветка:** v2  

---

## Архитектурное решение

**Оставить без изменений:**
- `server/` — все serverless handlers (auth, kv, files, push, ai)
- `src/*.js` — все 67 файлов бизнес-логики
- `docs/` — вся документация
- `public/` — PWA assets
- `package.json`, `.env*`, Vercel/Supabase конфиг

**Удалить:**
- `src/ClaudeMaintenanceApp.jsx` — монолит (удалить когда v2 готов)
- `src/main.jsx` — заменить новым

**Создать:**
```
src/
  app/              router, auth context, app shell, layout, theme
  features/
    tickets/        קריאות שירות — полный модуль
    fleet/          כלי שינוע, PM, инспекции
    cleaning/       ניקיון operational + management layer
    controls/       בקרות — правильно с нуля
    ppe/            ביגוד עובדים
    tasks/          מטלות + meetings
    dashboard/      attention layer + analytics
    settings/       настройки по владельцам модулей
    users/          пользователи, права
  shared/
    components/     переиспользуемые UI компоненты
    hooks/          shared hooks
    ui/             design tokens, base components
```

---

## Сессии

### Session 1 — [PENDING]
**Цель:** `src/app/` — фундамент приложения  
**Включает:** router, auth context, app shell, sidebar, layout, theme, role-based nav  
**Статус:** НЕ НАЧАТА  
**Промт:** `docs/rebuild-session-1-prompt.md`

### Session 2 — [WAITING]
**Цель:** `src/features/tickets/`  
**Статус:** ОЖИДАЕТ Session 1

### Session 3 — [WAITING]
**Цель:** `src/features/dashboard/`  
**Статус:** ОЖИДАЕТ Session 2

### Session 4 — [WAITING]
**Цель:** `src/features/fleet/`

### Session 5 — [WAITING]
**Цель:** `src/features/cleaning/` (operational + management layer)

### Session 6 — [WAITING]
**Цель:** `src/features/controls/` — полный редизайн

### Session 7 — [WAITING]
**Цель:** `src/features/ppe/`

### Session 8 — [WAITING]
**Цель:** `src/features/tasks/` + meetings

### Session 9 — [WAITING]
**Цель:** `src/features/users/` + `src/features/settings/`

---

## Проблемы которые исправляем при rebuild

(Источник: docs/system-audit-2026-07-05.md)

1. **בקרות вход** — открывается на пустой форме → должен быть operational overview
2. **Dual fleet inspection** — два потока данных (insp:* и controlRun:*) → один путь через ControlsHub
3. **Dashboard** — нет cross-module сигналов → строим настоящий attention layer
4. **מטלות** — нет source context в UI → показывать откуда пришла задача
5. **Cleaning management** — менеджер не имеет инструментов → добавить в ניקיון domain
6. **Developer copy** — "engine coming later" виден пользователям → убрать
7. **Checklist limit** — slice(0,8) молча → показывать счётчик/предупреждение
8. **N+1 writes** — каскадные записи по одной → пакетные записи

---

## Как обновлять этот файл

В конце каждой сессии Claude пишет:

```
### Session N — [дата]
Цель: [что было]
Сделано: [что реально написано, какие файлы]
Решения принятые: [если были архитектурные решения]
Следующая сессия: [точный target]
Статус: ЗАВЕРШЕНА
```

И обновляет статусы сессий выше.
