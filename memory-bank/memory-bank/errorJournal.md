# VideoFeedback — Error Journal

> Дневник проблем и решений. Обновляется агентом автоматически.

## [2026-03-14] Prisma migrate падал из-за BOM в старой миграции

**Симптом:** `prisma migrate` завершался с ошибкой синтаксиса при чтении SQL миграции.

**Причина:** В файле `20260302213000_billing_admin_mvp/migration.sql` был BOM в начале.

**Решение:** Удалил BOM из файла миграции, после чего `prisma migrate` проходит.

**Вывод:** Проверять SQL миграции на BOM при странных ошибках парсинга.

---

## [2025-03] trafficGb всегда сохраняется как 0

**Симптом:** KinescopeUsageSnapshot.trafficGb = 0 при любом использовании

**Причина:** Баг в логике парсинга ответа Kinescope API или в маппинге полей

**Решение:** Не исправлено, в бэклоге

**Вывод:** При работе с KinescopeUsageSnapshot не доверять полю trafficGb — оно невалидно

---

## [2025-03] Сломан rollover подписки

**Симптом:** При смене расчётного периода WorkspaceSubscription не обновляется корректно

**Причина:** Не исследовано

**Решение:** Не исправлено, в бэклоге

**Вывод:** При работе с WorkspaceSubscription.currentPeriodStart/End проверять логику rollover

---

## [2026-03-12] PowerShell не читает пути с () без LiteralPath

**Симптом:** Команда чтения файла с путём вида pp/(dashboard)/... падает в PowerShell.

**Причина:** () интерпретируются оболочкой, путь нужно передавать как LiteralPath или экранировать.

**Решение:** Использовать -LiteralPath в командах чтения/поиска.

**Вывод:** Для файлов с () в пути всегда применять LiteralPath.

---

## [2026-03-12] Запрет на npm.ps1 и npx в PowerShell

**Симптом:** 
pm install и 
px не запускаются из-за Execution Policy.

**Причина:** В системе запрещено выполнение PowerShell-скриптов.

**Решение:** Использовать 
pm.cmd и запускать инструменты напрямую через 
ode.

**Вывод:** Для тестов и скриптов в этой среде использовать 
pm.cmd и 
ode .\node_modules\....

---

## [2026-03-15] Baseline vitest run падает без prisma generate и API окружения

**Симптом:** `npm.cmd test` падает на многих suite с ошибкой `@prisma/client did not initialize yet`, а API tests падают с `ECONNREFUSED`.

**Причина:** Prisma client не сгенерен в worktree, и не поднят API/DB для интеграционных тестов.

**Решение:** Для локальных проверок запускать точечные UI-тесты. Полный прогон требует `prisma generate` и поднятого окружения.

**Вывод:** При проверке UI-фич использовать таргетный запуск vitest по файлу.

---

## [2026-03-15] Prisma migrate dev упал с Schema engine error без подробностей

**Симптом:** `prisma migrate dev` (и `--create-only`) падает с `Schema engine error` при наличии `DATABASE_URL`.

**Причина:** Не диагностирована (локальная среда/движок Prisma).

**Решение:** Миграцию создали вручную в `prisma/migrations/20260315133000_remove_non_kinescope_providers/migration.sql`.

**Вывод:** Если повторится — проверять версию Prisma CLI, доступность Postgres и логи движка; допускается ручная миграция при известной корректной SQL-логике.

---

## [2026-03-20] Legacy iOS shell конфликтовал с dashboard glass theme

**Симптом:** В dashboard sidebar пункты навигации выглядели белёсыми и смешивали светлую тему с тёмным интерфейсом.

**Причина:** Глобальный `AppThemeShell` оборачивал внутренние страницы в старый `data-app-shell="ios"` слой, а `globals.css` содержал большой набор legacy override-правил для светлой glass-темы.

**Решение:** Убрали route-based `ios` shell, удалили связанные CSS override-блоки и затемнили sidebar/dashboard navigation.

**Вывод:** Не держать параллельно два глобальных theme-layer для одного и того же dashboard UI — старые оболочки нужно удалять целиком, а не частично переопределять.

---

## [2026-03-28] Mobile sidebar ломался внутри project version page

**Симптом:** На обычных dashboard-страницах sidebar открывался, а внутри страницы версии проекта мобильное меню визуально/по тапу не работало стабильно.

**Причина:** Мобильный drawer sidebar рендерился внутри dashboard tree и зависел от layering/staking context тяжелого project/version UI.

**Решение:** Мобильную часть `Sidebar` перевели на portal в `document.body`; добавлен регрессионный тест, который проверяет, что mobile drawer больше не живет внутри dashboard container.

**Вывод:** Для full-screen project/version экранов мобильные overlay/drawer лучше сразу рендерить через portal, а не внутри route subtree.

---

## [2026-03-28] Sidebar-логика расползлась между layout и page-level UI

**Симптом:** Sidebar ломался именно на странице версии проекта, а dashboard shell содержал route-specific исключение (`hideHeader`), из-за чего проектный экран жил по отдельным правилам и тянул локальный menu flow.

**Причина:** Архитектура sidebar была не глобальной: часть поведения жила в общем layout, часть в header, часть в самой странице версии проекта, плюс оставались legacy-обертки вроде `VersionDetailMobileSidebar`.

**Решение:** Вынесли единый `DashboardShell`, убрали скрытие global header на version route, убрали page-level sidebar control из `projects/[id]/versions/[versionId]`, удалили мертвую `VersionDetailMobileSidebar`.

**Вывод:** Для dashboard-навигации нельзя держать route-specific sidebar режимы; shell должен быть единственным владельцем header/sidebar state и структуры.

---

## [2026-03-28] Portal sidebar терял dashboard-стили

**Симптом:** После перевода mobile sidebar в portal визуально могло казаться, что ничего не изменилось: drawer открывался вне `.dashboard-shell` и не наследовал glass/dashboard styling.

**Причина:** CSS sidebar завязана на селекторы вида `.dashboard-shell .glass-sidebar`; portal-root sidebar был вынесен в `document.body` без оболочки `.dashboard-shell`.

**Решение:** Portal-root мобильного sidebar теперь сам помечается классом `dashboard-shell`; добавлен тест, который проверяет, что mobile drawer действительно находится под `.dashboard-shell`.

**Вывод:** Если portal-контент зависит от ancestor-scoped theme CSS, theme-контекст нужно переносить в portal-root, иначе overlay может работать функционально, но выглядеть как будто “ничего не произошло”.

---

## [2026-03-28] Нельзя перепаковывать legacy sidebar под видом нового

**Симптом:** После нескольких фиксов стало ясно, что старый sidebar-контур оставался архитектурным мусором: даже когда баги частично закрывались, UI оставался неадаптивным и визуально слабым.

**Причина:** Было неверное решение переиспользовать legacy `Sidebar` и `MobileMenuButton` вместо полной замены компонента и его контракта.

**Решение:** Legacy sidebar/live imports удалены физически; новый `GlobalSidebar` и `SidebarToggleButton` созданы с нуля, а тесты переписаны под новый desktop/mobile контракт.

**Вывод:** Если пользователь просит “удалить и сделать заново”, нельзя тащить старый компонент как основу — сначала удаление live-кода, потом новые тесты, потом новая реализация.
