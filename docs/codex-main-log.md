# Codex Main / v1 Work Log

This file is the operating protocol for Codex work on the current CMMS system.

## Scope

Codex works only on `main` / v1, or on small `codex/*` branches created from `main`.

Claude works on `v2`. Codex must not touch that line.

## Hard Rules

- Work only with `main` / v1.
- Do not touch Claude / `v2`.
- Do not open `v2` branches as working branches.
- Do not use `v2` Supabase, env, or config.
- Do not copy or port decisions from `v2` into `main` without a direct owner command.
- Do not do a rebuild.
- Do not create `src/app`, `src/features`, or `src/shared` in `main` as a `v2` structure.
- Do not change router, layout, or entry point for new architecture.
- Work only on stability of the current system: bugs, tests, build, small safe changes, and documentation.

## STOP Protocol

Stop and prepare a new Codex session when any of these happens:

- The session became long.
- A complete bugfix was finished.
- The task became wider than the original scope.
- Changes touch auth, session, permissions, or server behavior.
- Tests or build failed.
- Any overlap with `v2` appears.
- Work starts turning into a rebuild.
- An owner decision is needed.

When STOP happens, update this file with a short session entry:

```text
Session:
Branch:
Goal:
Done:
Files changed:
Tests:
Not checked:
Risks / follow-up:
Next target:
Status:
```

Then tell the owner:

```text
🔴 ВРЕМЯ НОВОЙ CODEX-СЕССИИ

Сделано:
Текущая ветка:
Следующая сессия:

ПРОМТ — скопируй целиком:
[готовый промт для следующей Codex-сессии]
```

## New Codex Session Prompt Template

```text
Ты работаешь только с текущей CMMS-системой: main / v1.

Claude работает отдельно над v2. v2 не трогать:
- не переключаться на v2;
- не открывать v2-ветки как рабочие;
- не использовать v2 Supabase/env/config;
- не переносить код или решения из v2 в main без прямой команды владельца;
- не начинать rebuild в main;
- не создавать src/app, src/features, src/shared как v2-структуру;
- не менять router/layout/entry point ради новой архитектуры.

Перед началом выполни:
cd /Users/Vadim/Documents/CMMS
git fetch origin --prune
git status --short --branch
git log --oneline --decorate -5 origin/main
gh pr list --state open --json number,title,isDraft,headRefName

Прочитай:
- docs/active-work.md
- docs/codex-main-log.md
- только документы, относящиеся к текущей задаче

Работай маленькой веткой от main.
Зона Codex: текущая рабочая система, баги, стабильность, тесты, build, маленькие безопасные правки, документация.

После изменений запускай:
npm test -- --run
npm run build

Если наступает STOP-условие, обнови docs/codex-main-log.md и выведи блок:
🔴 ВРЕМЯ НОВОЙ CODEX-СЕССИИ
```

## Sessions

```text
Session: 2026-07-05 main/v1 protocol setup
Branch: codex/main-v1-log
Goal: Add Codex operating protocol for main/v1 and STOP handoff format.
Done: Created docs/codex-main-log.md with scope rules, hard v2 boundaries, STOP protocol, STOP output block, and new-session prompt template.
Files changed: docs/codex-main-log.md
Tests: npm test -- --run; npm run build.
Not checked: Application UI, because this is docs-only.
Risks / follow-up: Keep this file updated whenever STOP happens.
Next target: Continue only with small main/v1 stability or documentation tasks.
Status: Ready for PR.
```
