# Client Portal Redesign — Design Spec (2026-03-16)

## Контекст и цель
Нужно обновить UI клиентского портала `app/client-portal/[token]/page.tsx` в стиле macOS/Apple: больше воздуха, мягкая иерархия, глубина через прозрачность/blur, минимум рамок. Логика и поведение не меняются.

## Область изменений
- **Только UI** в `app/client-portal/[token]/page.tsx`.
- Без изменений в `lib/annotations/*`, API-вызовах, SWR, обработчиках, таймкодах и бизнес-логике.

## Требования к UI (по секциям)
### 1) Header
- Фон: `bg-black/60 backdrop-blur-xl`
- Нижняя граница: `border-white/5`
- Название проекта: `text-white font-medium`
- Версия: `text-white/40 text-xs`
- Кнопка «Утвердить версию»:
  - активная: `bg-emerald-500 rounded-full px-5 h-8 text-xs font-semibold`
  - утверждённая: `bg-white/8 text-white/30`

### 2) Плеер
- Убрать `border` полностью
- `rounded-2xl overflow-hidden`
- Контролы: нижний градиент `bg-gradient-to-t from-black/80 to-transparent`
- Кнопка карандаша убирается из area контролов (переезжает вниз)

### 3) Строка под плеером (полная замена)
Единая строка: `bg-white/4 rounded-2xl border border-white/6 px-4 py-2.5 flex items-center gap-3`

Состав:
- **Badge таймкода** (кликабельный, сбрасывает привязку)
  - `bg-blue-500/15 text-blue-400 text-xs font-mono px-2 py-1 rounded-lg`
- **Input** (одна строка, без textarea)
  - `bg-transparent border-none outline-none text-white/70 placeholder:text-white/25 flex-1 text-sm`
- **Иконка-карандаш** (триггер аннотаций)
  - `w-8 h-8 rounded-xl bg-white/5 border border-white/8`
  - active: `bg-blue-500/20 border-blue-500/40 text-blue-400`
- **Кнопка отправить**
  - `w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center`

### 4) Панель инструментов рисования
- Позиция: между плеером и строкой ввода
- Появляется при `annotationMode` с анимацией slide-down
- Контейнер: `bg-white/4 border border-white/6 rounded-2xl px-4 py-2.5 flex items-center gap-3`
- Группы инструментов/цветов/толщин в одну строку
- Разделители: `w-px h-5 bg-white/10`
- Кнопки инструментов: `w-8 h-8 rounded-xl`
  - active: `bg-white text-black`
  - default: `bg-transparent text-white/50 hover:text-white`
- Цвета: `w-5 h-5 rounded-full`
  - active: `ring-2 ring-white/60 ring-offset-1 ring-offset-transparent`

### 5) Правая панель (комментарии)
- Контейнер: `bg-transparent` (без фона)
- Заголовок: `text-[11px] font-medium text-white/30 uppercase tracking-widest px-1 mb-3`
- Карточки: без border/bg; `px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors cursor-pointer`
- Внутри:
  - автор: `text-xs font-medium text-white/80`
  - таймкод-pill: `text-[11px] text-blue-400 bg-blue-500/10 px-2 rounded-md`
  - текст: `text-sm text-white/55 leading-relaxed mt-1`
  - индикатор аннотации: точка `w-1.5 h-1.5 rounded-full bg-blue-500` перед текстом
- Разделитель между карточками: `border-b border-white/4` (уходит при hover)

### 6) Общий фон
- База: `bg-[#0a0a0a]`
- Лёгкий `radial-gradient` на левой колонке (синеватый, opacity ~0.03) вокруг плеера

### 7) Диалог подтверждения версии
- Контейнер: `bg-[#141414] border border-white/8 rounded-3xl`
- Кнопка подтверждения: `bg-emerald-500 rounded-full`

## Логика и поведение
- Логика аннотаций и overlay остаётся прежней.
- `submitFeedback` и вычисление `canSubmit` не меняются.
- Вместо `textarea` используется однострочный input, данные идут в тот же стейт.

## Риски и ограничения
- Нельзя трогать API, SWR, обработчики и бизнес-логику.
- Только визуальные и структурные изменения в рамках компонента страницы.

## Тестирование
- Специальные тесты не обязательны (UI-only), но при наличии UI-снимков/селекторов — проверить точечно.
