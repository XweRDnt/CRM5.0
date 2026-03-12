# Agent Instructions — VideoFeedback

## Начало каждой сессии

Перед любым действием прочитай эти файлы по порядку:

1. `memory-bank/projectBrief.md`
2. `memory-bank/techContext.md`
3. `memory-bank/activeContext.md`
4. `memory-bank/progress.md`
5. `memory-bank/errorJournal.md`

Без этого шага не приступай к работе.

## Процесс разработки

Следуй skills из `~/.agents/skills/superpowers/`:

- Любая новая фича → сначала `brainstorming`, потом `writing-plans`, потом `executing-plans`
- Любой код → строго TDD: сначала failing test, потом реализация (`test-driven-development`)
- После каждой задачи → `requesting-code-review`
- При баге → `systematic-debugging`

## Конец каждой сессии

Обнови файлы memory-bank:

1. `activeContext.md` — отметь выполненное, обнови приоритеты
2. `progress.md` — перенеси выполненное, добавь новые баги
3. `errorJournal.md` — запиши все нетривиальные проблемы которые встретились

## Жёсткие правила

- Стек: Next.js App Router + Prisma + PostgreSQL + BullMQ + Redis + Kinescope
- Мультитенантность: tenantId обязателен в каждом запросе к БД
- Роли в UI: только OWNER и EDITOR. PM есть в схеме но не реализован в UI — не используй его пока явно не скажут
- AI функций нет. Не трогай: AITask, ScopeDecision, WorkflowStage, Subscription (Stripe), Notification
- TypeScript строго, no any
- Без тестов код не считается готовым
