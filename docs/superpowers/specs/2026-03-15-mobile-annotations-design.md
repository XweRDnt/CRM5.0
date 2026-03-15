# Mobile Pseudo-Fullscreen Annotations — Design Spec (2026-03-15)

## Summary
- Добавляем мобильный режим аннотаций в клиентском портале через псевдо-fullscreen (CSS fixed overlay), без использования Fullscreen API.
- На мобильных устройствах при входе в аннотацию показываем статичный кадр (capture) как фон + слой рисования поверх.
- Десктопное поведение не меняем: текущий overlay на плеере сохраняется.

## Scope
- Только клиентский портал (`/client-portal/[token]`).
- Условия мобильного режима: `(max-width: 768px)` ИЛИ `navigator.maxTouchPoints > 0`.

## UX Flow
- Тап по карандашу:
  - плеер ставится на паузу;
  - захватывается таймкод;
  - берётся скрин кадра через существующий механизм capture (как для annotationPreview);
  - открывается псевдо-fullscreen.
- Псевдо-fullscreen:
  - `position: fixed; inset: 0; z-index: 9999; background: #0b0b0b`;
  - фон — скрин кадра (cover);
  - поверх — слой рисования.
- Панели управления:
  - верхняя фиксированная панель: слева `Отмена`, справа `Готово`;
  - плавающий draggable-виджет с иконками инструментов, цветов, толщины, undo/redo;
  - виджет сохраняет последнюю позицию между сессиями.
- `Готово`:
  - сохраняет штрихи в текущий `annotationStrokes` и возвращает в форму комментария;
  - закрывает fullscreen;
  - видео остаётся на паузе.
- `Отмена`:
  - закрывает fullscreen без сохранения;
  - не трогает текущие desktop-аннотации.
- Скролл/жесты страницы в fullscreen блокируются.

## Drawing Behavior (Mobile)
- Рисование через `touchstart`/`touchmove`/`touchend`.
- `touch-action: none` на слое рисования.
- Инструменты: arrow, rect, ellipse, line, freehand, text.
- Text:
  - тап по экрану ставит позицию;
  - появляется всплывающий input;
  - Enter/blur сохраняет текстовый штрих, Esc отменяет.

## Technical Notes
- Используем существующие функции:
  - `captureFrameDataUrl` (для кадра);
  - `overlaySvgOnFrame` (для превью при отправке комментария);
  - существующие типы `AnnotationData`/`AnnotationStroke`.
- В мобильном fullscreen поддерживаем отдельный временный список штрихов и переносим в общий `annotationStrokes` только по `Готово`.
- Draggable-виджет:
  - позиция хранится в state + localStorage;
  - drag через touch events с `preventDefault`.
- Десктопные pointer handlers не трогаем.

## Testing
- UI:
  - Мобильный режим включается по условию width/touch, на десктопе не активируется.
  - Кнопка карандаша открывает fullscreen, ставит паузу и сохраняет таймкод.
  - `Готово` переносит штрихи в payload, закрывает fullscreen.
  - `Отмена` закрывает fullscreen без штрихов.
- Touch:
  - freehand и фигуры корректно рисуются по touch.
  - текстовый input сохраняет текст в annotationData.

## Out of Scope
- Любые изменения `AITask`, `ScopeDecision`, `WorkflowStage`, `Subscription`, `Notification`.
- Роль PM и UI для неё.
- Полноэкранный режим через Fullscreen API.
