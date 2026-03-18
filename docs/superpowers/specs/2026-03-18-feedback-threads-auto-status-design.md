# Feedback Threads And Auto-Statuses — Design Spec

**Date:** 2026-03-18
**Scope:** Треды внутри карточек правок + автоматические статусы правок
**Primary Files:** `prisma/schema.prisma`, `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`, `app/client-portal/[token]/page.tsx`

## Summary
Добавить inline-thread внутри каждой правки на PM-экране и в клиентском портале, не смешивая сообщения треда с исходным текстом правки. Статус правки остаётся отдельной автоматической сущностью и меняется только по четырём продуктовым триггерам. Непрочитанные сообщения в треде показываются отдельным индикатором и не влияют на статус правки.

## Goals
- Раскрывать карточку правки как accordion с историей сообщений.
- Разрешить писать в тред: клиенту и `OWNER`/`PM`; `EDITOR` видит read-only чат.
- Показывать unread-индикатор на карточке правки.
- Автоматизировать статусы `NEW`, `VIEWED`, `IN_PROGRESS`, `RESOLVED` без ручного переключения.

## Non-Goals
- Ручное управление статусом правки.
- Отдельный статус у треда.
- Общий чат на всю версию вместо тредов по правкам.
- Смена базовой логики аннотаций или Kinescope.

## Product Decisions
- Исходный текст правки живёт в `FeedbackItem.text`.
- Сообщения треда живут отдельно и не перезаписывают `FeedbackItem`.
- Клик по карточке = раскрыть accordion + пометить все сообщения треда как прочитанные для текущего пользователя.
- `VIEWED` для правки означает, что сотрудник открыл страницу проекта и правка появилась в списке; открытие accordion для этого не требуется.
- Если клиент пишет новое сообщение в уже существующий тред, статус правки не меняется; появляется только unread-индикатор.

## Data Model
### Existing Entity
- `FeedbackItem`
  - остаётся базовой сущностью правки
  - хранит исходное сообщение клиента, timecode, annotation, автостатус

### New Entity: `FeedbackThreadMessage`
- `id`
- `feedbackItemId`
- `authorType` (`USER` | `CLIENT`)
- `authorUserId` nullable
- `authorName`
- `authorRoleLabel`
- `text`
- `createdAt`
- relation `FeedbackItem 1-N FeedbackThreadMessage`

### New Entity: `FeedbackThreadRead`
- `id`
- `feedbackItemId`
- `userId` nullable
- `clientIdentity` nullable
- `lastReadAt`
- compound unique:
  - `(feedbackItemId, userId)` for dashboard users
  - `(feedbackItemId, clientIdentity)` for portal clients

### Identity Rules
- Для dashboard read-state ключом выступает `userId`.
- Для client portal read-state ключом выступает стабильный `clientIdentity`, производный от portal token + author email/name.
- Для первой итерации допускается read-state на уровне “один клиентский участник портала”.

## Authorization
- `OWNER` и `PM`:
  - видят тред
  - могут писать
  - могут помечать сообщения прочитанными
- `EDITOR`:
  - видит тред
  - не может писать
  - может триггерить автостатус `VIEWED` на правке как сотрудник
- `CLIENT` через portal token:
  - видит треды только своего portal project
  - может писать
  - может помечать сообщения прочитанными

## Auto-Status Rules
| Trigger | New Status |
| --- | --- |
| Клиент создал новую правку | `NEW` |
| Любой сотрудник открыл страницу проекта и список правок загрузился | `VIEWED` |
| Монтажёр выгрузил XML | `IN_PROGRESS` |
| Загружена новая версия видео | `RESOLVED` |

## Auto-Status Semantics
- Ручное изменение статуса в UI удаляется полностью.
- Переходы статусов управляются серверной логикой, а не отдельными кнопками в карточке.
- `REJECTED` не участвует в новом поведении.
- Сообщения треда не меняют статус правки.

## Read / Unread Semantics
- Unread считается только для сообщений треда, не для исходной правки.
- Unread-индикатор отображается на карточке правки.
- При раскрытии карточки:
  - загружаются сообщения треда
  - сервер получает mark-as-read
  - unread badge исчезает после успешного обновления локального состояния

## API Shape
### Dashboard
- `GET /api/projects/[id]/feedback`
  - расширить ответ:
    - `threadMessageCount`
    - `threadUnreadCount`
    - `lastThreadMessageAt`
    - `lastThreadMessagePreview` optional
- `GET /api/feedback/[id]/thread`
- `POST /api/feedback/[id]/thread`
- `POST /api/feedback/[id]/thread/read`

### Public Portal
- `GET /api/public/feedback/[id]/thread?token=...`
- `POST /api/public/feedback/[id]/thread`
- `POST /api/public/feedback/[id]/thread/read`

## UI Design
### PM View
- Карточка правки остаётся верхним контейнером.
- Клик по карточке:
  - раскрывает inline accordion
  - показывает историю сообщений
  - показывает composer снизу, если роль `OWNER`/`PM`
- Для `EDITOR` composer заменяется read-only note.
- На карточке остаются:
  - статус работы
  - unread-indicator
  - краткий preview последнего сообщения при наличии

### Client Portal
- В списке правок у клиента появляется такой же accordion-pattern.
- Клиент видит собственные и командные ответы внутри конкретной правки.
- Composer доступен клиенту всегда, пока версия открыта для feedback.

## Service Responsibilities
- `FeedbackService`
  - расширить list/get methods метаданными тредов
  - добавить операции создания thread message
  - добавить операции mark-as-read
  - добавить операции bulk auto-transition for statuses
- отдельный helper/service слой для вычисления auto-status transitions допустим, если `FeedbackService` начнёт разрастаться

## Trigger Integration Points
- `POST /api/public/feedback`
  - создание правки со статусом `NEW`
- dashboard version page load
  - server PATCH/bulk action для перевода `NEW -> VIEWED`
- XML export action on version page
  - вызывает автообновление `VIEWED|NEW -> IN_PROGRESS`
- version upload flow
  - при создании новой версии завершает правки прошлой активной версии в `RESOLVED`

## Error Handling
- Пустой тред показывает empty-state, а не ошибку.
- Если mark-as-read не удался, accordion остаётся открытым, unread badge не скрывается оптимистично навсегда.
- Если отправка сообщения не удалась, composer сохраняет текст и показывает toast.

## Testing
- Prisma/service tests:
  - unread count per role
  - mark-as-read on accordion open
  - client message does not change feedback status
  - XML export moves statuses to `IN_PROGRESS`
  - new version upload moves previous version feedback to `RESOLVED`
- API tests:
  - dashboard thread endpoints authorization
  - portal thread endpoints token scoping
  - `EDITOR` cannot post thread messages
- UI tests:
  - accordion expands inline
  - unread badge clears after opening
  - composer hidden/disabled for editor

## Open Questions
- Для первой итерации считать client read-state по одному участнику портала на token, без мультиклиентского разделения внутри одного token.
- Если позже понадобится несколько клиентских собеседников на один token, расширить `clientIdentity` без перелома API-контракта.
