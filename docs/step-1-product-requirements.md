# ШАГ 1. Product Requirements Document (MVP) для AI-CRM в нише video editing agencies

Дата: 13 февраля 2026  
Горизонт MVP: 4-8 недель

## 1) Исследование ниши (на реальных источниках)

### 1.1 Основные pain points агентств монтажа видео (2024-2026)
| Боль | Что подтверждает | Влияние на бизнес |
|---|---|---|
| Хаос правок: комментарии в чатах/почте без таймкодов, разрозненные каналы | Reddit (VideoEditors, Videography) + практики review tools | Потери времени на ручную агрегацию, задержки согласований |
| Бесконечные/размытые ревизии и scope creep | Reddit (editors/videography) | Съедает маржу, конфликты с клиентами |
| Долгие апдейты статусов и "work about work" | Asana research: большой % времени уходит на координацию вместо core-work | PM перегружен операционкой |
| Инструменты фрагментированы (PM отдельно, review отдельно, CRM отдельно) | Capterra/G2 отзывы + позиционирование Yamdu/Frame.io/StudioBinder/Flow | Перекладывание данных вручную, ошибки |
| Рост стоимости при масштабировании команды | Capterra/G2 (monday/StudioBinder и др.) | Низкая юнит-экономика для малых студий |

### 1.2 Что уже есть на рынке (CRM/production tools)
| Продукт | Что делает хорошо | Ограничения/разрывы для video agencies |
|---|---|---|
| Frame.io | Сильный review/approval, комментарии по кадрам, sharing/security, Camera-to-Cloud | Не полноценный CRM для лидов/сделок/биллинга; отзывы о storage lock-in и поддержке |
| StudioBinder | Pre-production: call sheets, schedule, stripboard | По отзывам: learning curve, UX/поддержка/цена для small teams |
| Yamdu | Единая production-платформа (script breakdown, call sheets, calendars) | Больше про production ops, чем про клиентский CRM + unit-экономику small agency |
| Autodesk Flow Production Tracking (ShotGrid) | Мощный tracking, ресурсы, review, enterprise-подход | Часто "overkill" и дорогой/сложный вход для 5-20 человек |
| monday.com (часто адаптируют как agency CRM/PM) | Гибкие борды, автоматизации, интеграции | Отзывы: clutter, manual data entry, лаги на больших досках, стоимость по мере роста |
| Studio Ninja / Dubsado (photo/video SMB CRM) | Лиды, бронирование, инвойсы, workflows | Слабее в видеоспецифичном review/versioning и AI-оркестрации правок |

### 1.3 Рутинные задачи PM, которые "съедают" время
1. Сбор правок из email/чатов/голосовых сообщений в единый action list.
2. Синхронизация статусов между командой и клиентом.
3. Контроль дедлайнов ревизий и "догоняющие" напоминания.
4. Сопоставление новых правок с исходным брифом/контрактом (scope vs out-of-scope).
5. Подготовка клиентских апдейтов и закрывающих документов (инвойс/акт/summary).

### 1.4 AI-технологии, уже применяемые в нише
1. AI в NLE/посте: Adobe Premiere Pro (Generative Extend, Media Intelligence, auto caption translation).
2. AI-текстовый монтаж/чистка речи: Descript (filler words removal и др.).
3. AI-генерация/трансформация видео: Runway workflows.
4. AI-клиппинг short-form: OpusClip (авто-клиппинг, captions, multi-platform).

### 1.5 Вывод исследования
Самая болезненная и монетизируемая проблема: **хаос ревизий и обратной связи**, из-за которого PM тратит часы на ручную координацию, сроки сдвигаются, а маржа падает.

## 2) Определение продукта

### Core Value Proposition
- Главная проблема: неуправляемый цикл "фидбек -> правки -> согласование".
- Почему платят: прямой финансовый эффект (меньше неоплаченных правок, быстрее финальный approve, выше пропускная способность PM).
- Уникальность: **CRM + review + AI scope guard** в одном потоке, а не набор разрозненных инструментов.

### Целевая аудитория (MVP)
- Primary user: Project Manager / Account Manager.
- Secondary: Owner/Operations lead, Lead editor.
- Размер агентств: **5-20 человек** (самый чувствительный сегмент: уже есть процессы, но нет enterprise-бюджета и dedicated ops-team).

### MVP-функции (3-5)
1. Unified Review Inbox (таймкод-комментарии, версии, статусы).
2. AI Feedback Parser (сводка, дедупликация, приоритизация, задачи).
3. Scope Guard (сопоставление с брифом/SOW, флаг out-of-scope).
4. Client Delivery Workflow (этапы, SLA-таймеры, авто-напоминания и клиентские апдейты).

## 3) Функциональные требования MVP

### Функция: Unified Review Inbox
- Проблема, которую решает: правки "размазаны" по каналам, теряются и дублируются.
- Как работает:
  1. PM загружает версию видео или подключает ссылку на файл.
  2. Клиент оставляет комментарии с таймкодами в portal link.
  3. Система хранит версионность и статус каждого комментария.
  4. PM переводит комментарии в задачи и назначает исполнителей.
- AI-компонент: авто-классификация комментариев по типам (content/design/sound/legal).
- Критерии успеха:
  - 95% комментариев имеют owner + статус.
  - Потерянные комментарии = 0.
  - Время сбора правок сокращено минимум на 40%.

### Функция: AI Feedback Parser
- Проблема, которую решает: ручная обработка больших и неструктурированных блоков обратной связи.
- Как работает:
  1. Система собирает текст, голос/видео-комменты и email feedback.
  2. Транскрибирует (если нужно), нормализует и удаляет дубликаты.
  3. Формирует "Action List" с приоритетом, дедлайном, ответственным.
  4. PM подтверждает/редактирует и публикует команде.
- AI-компонент: LLM для суммаризации, dedupe, extraction action items.
- Критерии успеха:
  - Precision action extraction >= 85%.
  - Сокращение времени PM на подготовку брифа для монтажера >= 50%.

### Функция: Scope Guard
- Проблема, которую решает: бесплатные правки вне контракта.
- Как работает:
  1. При старте проекта загружается бриф/SOW и лимит ревизий.
  2. Каждая новая правка сравнивается с baseline scope.
  3. Система помечает `in-scope` / `potential out-of-scope`.
  4. PM отправляет клиенту шаблон "change request" с оценкой.
- AI-компонент: семантическое сравнение "новый запрос vs исходный scope".
- Критерии успеха:
  - Доля неоплаченных out-of-scope правок снижается минимум на 30%.
  - PM принимает финальное решение <= 2 минуты на запрос.

### Функция: Client Delivery Workflow
- Проблема, которую решает: срывы дедлайнов из-за слабой процессной дисциплины.
- Как работает:
  1. Шаблон pipeline: Draft -> Internal QA -> Client Review -> Final.
  2. На каждом этапе SLA-таймер и автоматические напоминания.
  3. Клиент получает понятный статус и next step.
  4. После approve запускается handoff и финальное уведомление.
- AI-компонент: генерация краткого клиентского апдейта по изменениям версии.
- Критерии успеха:
  - Median time-to-approval сокращается на 25%.
  - On-time delivery >= 90%.

## 4) Технические требования

### Платформа
**Web application (desktop-first + mobile-adaptive).**

Почему:
1. PM и owner работают в браузере с ноутбука.
2. Клиентам нужен "нулевой порог" входа по ссылке без установки приложения.
3. Быстрее MVP-цикл и проще поддержка.

### Технологический стек (оптимум для быстрого MVP)
| Слой | Выбор | Обоснование |
|---|---|---|
| Frontend | Next.js (React, TypeScript) | Быстрое fullstack-развертывание, SSR/edge, зрелая экосистема |
| Backend API | Next.js Route Handlers + background workers (Node) | Меньше операционной сложности на MVP |
| Очереди/async | Redis + BullMQ | Обработка AI-задач и webhook-джоб |
| БД | PostgreSQL | Реляционные связи CRM/проекты/версии/комментарии, надежно и масштабируемо |
| Файлы | S3-compatible storage (AWS S3 или Cloudflare R2) | Дешевое хранение медиа, signed URLs |
| AI/ML | OpenAI API (LLM + speech-to-text), резервно Anthropic/OpenRouter | Быстрый запуск без обучения своих моделей |
| Хостинг | Vercel (web/api) + managed Postgres + managed Redis | Минимум DevOps на старте, быстрый релиз |

### Интеграции
1. Оплаты: Stripe.
2. Email: Resend или Postmark.
3. SMS/WhatsApp (опционально после MVP): Twilio.
4. Хранилища: Google Drive/Dropbox (import/export).
5. Коммуникации: Slack (уведомления команде).
6. AI API: OpenAI (primary), Anthropic (fallback).

## 5) Нефункциональные требования

### Производительность
- MVP-цель: 100 агентств, до 2,000 monthly active users, до 300 одновременных сессий.
- p95 API response < 600ms (без тяжелых AI-операций).
- p95 UI page load < 2.5s.
- AI parsing одного пакета feedback: < 90 сек.

### Безопасность
- Multi-tenant изоляция по `tenant_id`.
- RBAC (owner, PM, editor, client-viewer).
- Signed URLs для файлов, шифрование at rest/in transit.
- Audit log по статусам и approve-действиям.
- GDPR baseline: consent, DPA, data export/delete requests.

### Масштабируемость
- Горизонтальное масштабирование stateless API.
- Очереди для AI-job и retry/idempotency.
- Партиционирование медиа-операций и lifecycle policy для storage.

### Бюджет и сроки MVP (4-8 недель)
| Блок | Срок | Оценка стоимости (USD) |
|---|---|---|
| Discovery + UX + архитектура | 1 неделя | 2,000-5,000 |
| Разработка core MVP | 4-6 недель | 12,000-30,000 |
| QA + hardening + запуск | 1 неделя | 2,000-6,000 |
| Итого | 6-8 недель | **16,000-41,000** |

## 6) Границы MVP (что НЕ делаем)
1. Полноценный NLE-видеоредактор внутри продукта.
2. Сложный финансовый модуль (P&L, payroll, advanced accounting).
3. Mobile native app (iOS/Android).
4. Авто-генерация финального видео "под ключ" (генеративный монтаж end-to-end).
5. Marketplace фрилансеров/подрядчиков.

Причина: не влияет напрямую на fastest path к решению главной боли "review/scope chaos".

## 7) Definition of Done (MVP)
- [ ] Multi-tenant auth + роли + безопасный доступ к проектам.
- [ ] Проект, версии видео, таймкод-комментарии и статусы работают end-to-end.
- [ ] AI Feedback Parser стабильно формирует action list и проходит ручную валидацию PM.
- [ ] Scope Guard помечает out-of-scope запросы и логирует решения PM.
- [ ] SLA-напоминания и клиентские статус-апдейты отправляются автоматически.
- [ ] Stripe подписка и базовый биллинг активны.
- [ ] Базовая аналитика: time-to-approval, revision count, overdue rate.
- [ ] Пройден smoke + regression, нет критических P1 багов.

## 8) Пользовательские сценарии (User Stories)

### Story 1
Как PM агентства  
Я хочу получать весь клиентский фидбек в одном месте с таймкодами  
Чтобы не тратить время на сбор комментариев из разных каналов

Acceptance Criteria:
- Клиент может оставить комментарий по таймкоду без регистрации.
- PM видит единый список комментариев по версии с фильтрами по статусу.

### Story 2
Как PM  
Я хочу, чтобы AI превращал комментарии в структурированный список задач  
Чтобы быстрее выдавать четкое ТЗ монтажеру

Acceptance Criteria:
- Система создает action items с приоритетом и предложенным исполнителем.
- PM может подтвердить/исправить список до публикации.

### Story 3
Как владелец агентства  
Я хочу видеть, какие правки выходят за рамки контракта  
Чтобы не терять маржу на бесплатной дополнительной работе

Acceptance Criteria:
- Каждый новый запрос получает метку in-scope / potential out-of-scope.
- PM может одним действием отправить change request клиенту.

### Story 4
Как клиент  
Я хочу получать понятные статус-апдейты по проекту  
Чтобы понимать, когда будет следующий драфт и финальная сдача

Acceptance Criteria:
- После каждого этапа клиент получает авто-сводку изменений.
- В клиентском portal видны текущий статус, дедлайн и ожидаемое действие.

### Story 5
Как lead editor  
Я хочу видеть приоритизированный и недублированный список правок  
Чтобы быстрее выпускать новую версию без лишних итераций

Acceptance Criteria:
- Дубликаты правок объединяются AI до передачи в работу.
- Каждая правка имеет источник, таймкод и owner.

## 9) Структура данных (основные сущности)

### Сущности и ключевые поля
1. Tenant (agency)
   - id, name, plan, timezone, created_at
2. User
   - id, tenant_id, role, name, email, status
3. ClientAccount
   - id, tenant_id, company_name, contact_name, email, phone
4. Project
   - id, tenant_id, client_account_id, name, status, due_date, budget, scope_doc_url
5. ProjectMember
   - id, project_id, user_id, role_on_project
6. AssetVersion
   - id, project_id, version_no, file_url, duration_sec, uploaded_by, created_at
7. FeedbackItem
   - id, asset_version_id, author_type, author_id/email, timecode_ms, text, status, category
8. AITask
   - id, project_id, source_feedback_ids, summary, priority, assignee_user_id, due_date, state
9. ScopeDecision
   - id, project_id, feedback_item_id, ai_label, pm_decision, reason, change_request_amount
10. WorkflowStage
   - id, project_id, stage_name, sla_hours, started_at, completed_at, owner_user_id
11. Notification
   - id, tenant_id, channel, recipient, template_key, payload, sent_at, delivery_status
12. Subscription
   - id, tenant_id, stripe_customer_id, plan, seats, status, renewal_at
13. AuditLog
   - id, tenant_id, actor_user_id, entity_type, entity_id, action, meta_json, created_at

### Связи (упрощенно)
```text
Tenant 1--N User
Tenant 1--N ClientAccount
ClientAccount 1--N Project
Project 1--N AssetVersion
AssetVersion 1--N FeedbackItem
Project 1--N AITask
FeedbackItem 1--N ScopeDecision
Project 1--N WorkflowStage
Tenant 1--N Subscription
Tenant 1--N AuditLog
```

## 10) Рекомендации для следующего шага

### Ключевые риски
1. Низкая точность AI-классификации scope на старте.
2. Сопротивление клиентов переходу с email/WhatsApp на portal.
3. Риски стоимости AI API при больших объемах медиа.
4. Интеграционные edge-cases (разные форматы/источники файлов).

### Вопросы до старта разработки
1. Какой SLA и штрафы обещаем клиентам агентства в продукте?
2. Нужна ли юридическая "approve trail" (e-sign, immutable logs) уже в MVP?
3. Какая ценовая модель: per-seat, per-project или usage-based?
4. Какие каналы входящего фидбека в MVP обязательны (portal only vs email ingest)?

### Что реализовать первым
**Первой функцией делать Unified Review Inbox**, потому что:
1. Это ядро ценности и источник данных для AI.
2. Без него невозможно качественно обучить/настроить Feedback Parser и Scope Guard.
3. Дает быструю видимую пользу пользователю уже в первой итерации.

## Источники (реальные, использованы в анализе)
1. Reddit (VideoEditors): client feedback pain, timestamp/comments chaos  
https://www.reddit.com/r/VideoEditors/comments/1n3p56o
2. Reddit (Videography): difficult clients, endless revisions  
https://www.reddit.com/r/videography/comments/1d9yq6v
3. Reddit (Editors): revision requests and scope abuse patterns  
https://www.reddit.com/r/editors/comments/1ckvawp
4. Capterra: monday.com reviews (pros/cons, pricing, clutter/performance)  
https://www.capterra.com/p/147657/monday-com/reviews/
5. Capterra: Frame.io reviews (pros/cons incl. storage/support complaints)  
https://www.capterra.com/p/148214/Frame-io/reviews/
6. G2: StudioBinder reviews (усложнение UX, support/pricing feedback)  
https://www.g2.com/products/studiobinder/reviews
7. Yamdu official site (production management feature set)  
https://yamdu.com/
8. StudioBinder support (call sheet/schedule workflows)  
https://support.studiobinder.com/en/articles/6732605-how-to-create-a-call-sheet
9. Autodesk Flow Production Tracking overview/features  
https://www.autodesk.com/products/flow-production-tracking/overview
10. Adobe Blog (Premiere Pro 25.2 AI features)  
https://blog.adobe.com/en/publish/2025/04/02/introducing-new-ai-powered-features-workflow-enhancements-premiere-pro-after-effects
11. Descript Help (AI filler words removal)  
https://help.descript.com/hc/en-us/articles/10164806394509-Remove-filler-words
12. Runway Workflows official  
https://runwayml.com/workflows
13. OpusClip pricing/features  
https://www.opus.pro/pricing
14. Asana Anatomy/Work-about-work research  
https://asana.com/resources/pandemic-paradigm-shift

