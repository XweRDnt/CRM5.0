# VideoFeedback — Tech Context

## Стек

| Слой | Технология |
|------|------------|
| Framework | Next.js (App Router) |
| База данных | PostgreSQL |
| ORM | Prisma |
| Очереди | BullMQ + Redis |
| Видео | Kinescope API |
| Хостинг | Railway |
| Язык | TypeScript |

## Ключевые модели БД

### Tenant
Агентство. Верхний уровень изоляции. Всё привязано к `tenantId`.

### Workspace
Рабочее пространство агентства (1:1 с Tenant). Содержит Kinescope project и subscription-контур.

### WorkspaceMember
Участники workspace. В основном UI и операционном контуре реально доведены роли `OWNER` и `EDITOR`.

### InviteLink
Ссылки-приглашения в workspace. Есть выдача, просмотр и принятие invite link.

### User
Пользователь системы. В схеме есть роли `OWNER | PM | EDITOR | CLIENT_VIEWER`.
`PM` уже присутствует в домене, access-control и части сервисов, но ещё не доведён как главная операционная роль продукта.

### ClientAccount
Клиент агентства: компания, контакт, email, телефон.

### Project
Проект для клиента. Содержит `portalToken` для гостевого доступа и статусы проекта.

### AssetVersion
Версия видео внутри проекта. Хранит номер версии, Kinescope ids, stream url, approve state.

### FeedbackItem
Комментарий / правка по версии. Поддерживает таймкод, текст, status и annotation data.

### Feedback Thread / Read State
По каждой правке есть тред обсуждения и read-state контур. Это уже рабочая часть продукта, а не бэклог.

### BillingPlan
Тарифный план с лимитами: проекты, участники, трафик, хранилище, минуты транскодинга.

### WorkspaceSubscription
Активная подписка workspace. Биллинг сейчас ручной, не Stripe.

### KinescopeUsageSnapshot
Кэш использования Kinescope API для workspace billing / usage review.

### AuditLog
Базовый аудит действий.

## Что уже есть в интерфейсе

- Dashboard для проектов, клиентов, команды, настроек и админки.
- Team page: список участников + invite links.
- Client portal: review, annotations, approve, threads.
- Scope page: отдельный UI-контур для Scope Guard решений.
- Admin page: планы, usage, workspace billing, block/unblock.
- Reset portal token из UI версии проекта.

## Частично живые модули

### ScopeDecision / Scope Guard
Модуль уже существует технически: schema, service, API и UI.
Но сейчас он не является главным продуктовым приоритетом и не считается ядром value proposition.

### Notification / Telegram
Полноценной notification platform ещё нет.
При этом Telegram notification service уже используется в некоторых portal-сценариях как технический контур.

### PM
PM уже не "полностью отсутствует": роль есть в схеме и некоторых проверках доступа.
Но она ещё не доведена как полноценная operating role для агентства.

## Мёртвые или недоведённые направления

- `AITask` — AI-задачи в продукт не доведены.
- `WorkflowStage` — отдельный workflow engine в рабочий продукт не доведён.
- `Subscription` (Stripe-контур) — не используется, текущий billing manual/admin-driven.

## Важные соглашения

- Все запросы к БД идут через Prisma Client.
- Tenant isolation обязательна в каждой доменной операции.
- Клиентский доступ идёт через `portalToken`, без отдельной регистрации.
- Видео хранится через Kinescope, а приложение держит метаданные и workflow вокруг него.
- BullMQ используется для фоновых задач и асинхронной обработки.
- Billing guard проверяет лимиты перед созданием проектов, версий и участников.

## Известные баги

- `trafficGb` сейчас сохраняется некорректно в `KinescopeUsageSnapshot`.
- Сломан rollover подписки при смене периода.
