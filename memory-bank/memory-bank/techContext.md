# VideoFeedback — Tech Context

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js (App Router) |
| База данных | PostgreSQL |
| ORM | Prisma |
| Очереди | BullMQ + Redis |
| Видео | Kinescope API (загрузка + стриминг) |
| Хостинг | Railway |
| Язык | TypeScript |

## Ключевые модели БД (активные)

### Tenant
Агентство. Верхний уровень иерархии. Всё привязано к tenantId.

### Workspace
Рабочее пространство агентства (1:1 с Tenant). Содержит kinescopeProjectId для хранения видео.

### WorkspaceMember
Сотрудники workspace. Роли: OWNER | EDITOR.

### InviteLink
Токен для приглашения сотрудников. Expire-based, isActive флаг.

### User
Сотрудник агентства. Роли в схеме: OWNER | PM | EDITOR | CLIENT_VIEWER. В UI реально используются только OWNER и EDITOR.

### ClientAccount
Клиент агентства. companyName, contactName, email, phone.

### Project
Проект (видео для клиента). Содержит portalToken для гостевого доступа клиента. Статусы: DRAFT | IN_PROGRESS | CLIENT_REVIEW | COMPLETED | ON_HOLD | CANCELLED.

### AssetVersion
Версия видео. versionNo уникален в рамках проекта. Видео хранится в Kinescope (kinescopeVideoId, streamUrl). Статусы: DRAFT | IN_REVIEW | CHANGES_REQUESTED | APPROVED | FINAL.

### FeedbackItem
Комментарий к версии. Может быть от User (authorType: USER) или от клиента без аккаунта (authorType: CLIENT, authorEmail/authorName). timecodeSec — таймкод. Статусы: NEW | IN_PROGRESS | RESOLVED | REJECTED.

### BillingPlan
Тарифный план. Коды: FREE | START | GROWTH | BUSINESS. Лимиты: maxProjects, maxMembers, maxTrafficGb, maxStorageGb, maxTranscodingMinutes.

### WorkspaceSubscription
Активная подписка workspace. Биллинг ручной (не Stripe). cycle: CALENDAR_MONTH.

### KinescopeUsageSnapshot
Кэш данных об использовании из Kinescope API (трафик, хранилище, транскодинг).

## Мёртвые модели (в схеме, не используются в UI)

- `AITask` — планировалось для AI задач, не реализовано
- `ScopeDecision` — AI классификация правок, не реализовано
- `WorkflowStage` — этапы workflow, не реализовано
- `Subscription` — Stripe биллинг, не реализован
- `Notification` — система уведомлений, не реализована

## Важные соглашения

- Все запросы к БД через Prisma Client
- Мультитенантность через tenantId в каждой модели
- Гостевой доступ клиентов через portalToken (без auth)
- Видео загружается через Kinescope, streamUrl сохраняется в AssetVersion
- BullMQ используется для фоновых задач (обработка видео)
- Биллинг проверяется перед созданием проектов/версий/участников

## Известные баги

- trafficGb всегда сохраняется как 0 в KinescopeUsageSnapshot
- Сломан rollover подписки при смене периода
