# Client Portal Redesign — Design Spec (2026-03-16)

## Контекст и цель
Нужно обновить UI клиентского портала `app/client-portal/[token]/page.tsx` по референсу `c:\Users\Hlebg\Downloads\portal-mockup.html`. Стиль — стеклянные поверхности, мягкие градиенты, воздух, минимализм. Логика и поведение не меняются.

## Область изменений
- **Только UI** в `app/client-portal/[token]/page.tsx`.
- Без изменений в `lib/annotations/*`, API-вызовах, SWR, обработчиках, таймкодах и бизнес-логике.

## Требования к UI (по секциям)
### 1) Header (glass)
- Фиксированный, `h-12`, `rounded-[18px]`, отступы `px-5`, `top-3`.
- Фон: `bg-white/[0.048] backdrop-blur-2xl`.
- Граница: `border border-white/10`.
- Название: `text-[14px] font-medium text-white/90 tracking-[-0.02em]`.
- Версия: `text-[11px] text-white/30`.
- Кнопка «Утвердить версию»:
  - активная: `bg-[#4F8EF7] text-white rounded-full px-4 h-[30px] text-[12.5px] font-semibold shadow-[0_2px_14px_rgba(79,142,247,0.35)]`
  - disabled/approved: сохраняем визуально приглушённую (бледная).

### 2) Плеер (video island)
- Обертка: `rounded-[18px] overflow-hidden` без бордера.
- Тень: `shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_0_0.5px_rgba(255,255,255,0.07)]`.
- Контролы: нижний градиент `from-black/90 via-black/30 to-transparent` + slim progress bar.
- Левая колонка на глубоком фоне `#09090f` с мягкими radial‑градиентами (как в mockup).

### 3) Строка под плеером (input island)
Единый стеклянный pill (glass):
`bg-white/[0.048] border border-white/10 rounded-[18px] px-[13px] py-[10px] flex items-center gap-[10px]`

Состав:
- **Badge таймкода**
  - `bg-[#4F8EF7]/14 text-[#6B9FFF] text-[11.5px] font-semibold font-mono px-[9px] py-[4px] rounded-[8px] border border-[#4F8EF7]/28`
- **Input** (одна строка, без textarea)
  - `bg-transparent border-none outline-none text-white/70 placeholder:text-white/25 flex-1 text-sm`
- **Иконка-карандаш**
  - `w-8 h-8 rounded-[9px] bg-white/5 border border-white/10 text-white/40`
  - active: `bg-[#4F8EF7]/14 border-[#4F8EF7]/30 text-[#6B9FFF]`
- **Кнопка отправить**
  - `w-8 h-8 rounded-[9px] bg-[#4F8EF7] shadow-[0_2px_12px_rgba(79,142,247,0.3)]`

Дополнение по строке ввода:
- Имя и текст — внутри одного контейнера без видимой границы между ними
- Имя: `text-sm text-white/40 w-20 flex-shrink-0 bg-transparent border-none outline-none`
- Разделитель между именем и текстом: `w-px h-4 bg-white/10`
- Текст: `bg-transparent border-none outline-none text-white/70 placeholder:text-white/25 flex-1 text-sm`

### 4) Панель инструментов рисования (draw island)
- Позиция: между плеером и строкой ввода.
- Стеклянный контейнер: `bg-white/[0.048] border border-white/10 rounded-[18px]`.
- Анимация раскрытия высоты (как в mockup): `max-h` + opacity.
- Инструменты: кнопки `w-8 h-8 rounded-[9px]`, active `bg-white/90 text-black`, hover `bg-white/8`.
- Цвета: `w-[18px] h-[18px] rounded-full`, active с обводкой `border-white/70`.
- Толщины: `S/M/L` в pills.

### 5) Правая панель (комментарии)
- Контейнер: `glass` (`bg-white/[0.048] border border-white/10 rounded-[18px]`).
- Заголовок: `text-[10.5px] font-semibold tracking-[0.09em] uppercase text-white/25 px-4 py-3`.
- Список: минималистичный, с лёгким hover, тонкой разделяющей линией между элементами.
- Таймкод: `text-[11px] text-[#6B9FFF] bg-[#4F8EF7]/12 px-2 py-[2px] rounded-[7px]`.
- Текст: `text-[13px] text-white/40 leading-[1.55]`.

### 6) Общий фон
- База: `#09090f`.
- Множественные radial‑градиенты (как в mockup) для глубины.

### 7) Диалог подтверждения версии
- Контейнер: `bg-[#141414] border border-white/8 rounded-3xl`
- Кнопка подтверждения: `bg-emerald-500 rounded-full`

## Логика и поведение
- Логика аннотаций и overlay остаётся прежней.
- `submitFeedback` и вычисление `canSubmit` не меняются.
- Вместо `textarea` используется однострочный input, данные идут в тот же стейт.
- Поле ввода использует существующий `useState` для текста комментария.
- `onSubmit` — существующая функция `submitFeedback`.
- `onKeyDown`: `Enter` отправляет (если `canSubmit`); `Shift+Enter` не поддерживается (одна строка).

## Багфиксы
- Имена авторов не должны отображаться как `?????` — исправить источник (данные) и UI‑fallback.
- Кнопка карандаша должна корректно переключать `annotationMode` (не трогая логику аннотаций, только триггер).

## Риски и ограничения
- Нельзя трогать API, SWR, обработчики и бизнес-логику.
- Только визуальные и структурные изменения в рамках компонента страницы.

## Тестирование
- Специальные тесты не обязательны (UI-only), но при наличии UI-снимков/селекторов — проверить точечно.
