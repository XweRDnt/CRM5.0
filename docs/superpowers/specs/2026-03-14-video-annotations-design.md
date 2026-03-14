# Video Annotations — Design Spec (2026-03-14)

## Summary
- Добавляем аннотации к комментариям в клиентском портале: рисование поверх кадра, привязка к таймкоду.
- Сохраняем данные аннотаций в `FeedbackItem.annotationData` и превью в `FeedbackItem.annotationPreview` (URL PNG).
- В дашборде сотрудников показываем превью в списке комментариев версии; клик открывает оверлей на таймкоде.

## Data Model
- `FeedbackItem.annotationData: Json?` (уже существует).
- `FeedbackItem.annotationPreview: String?` — URL публичного PNG в S3.
- Формат аннотаций (версия 1):

```ts
export type AnnotationStroke = {
  type: "arrow" | "rect" | "ellipse" | "line" | "freehand" | "text";
  points: Array<{ x: number; y: number }>;
  color: "red" | "yellow" | "green" | "blue" | "white";
  thickness: "thin" | "medium" | "thick";
  text?: string;
};

export type AnnotationData = {
  version: 1;
  strokes: AnnotationStroke[];
};
```

- Все координаты в относительных единицах `0..1`.
- `points`:
  - `rect/ellipse/line/arrow`: 2 точки (start/end).
  - `freehand`: массив точек.
  - `text`: 1 точка + `text`.

## UI/UX (Client Portal)
- Вход в режим аннотации:
  - видео ставится на паузу;
  - canvas поверх кадра, остальной UI затемняется.
- Инструменты: стрелка, прямоугольник, эллипс, линия, freehand, текст.
- Контролы:
  - Цвета: красный, жёлтый, зелёный, синий, белый.
  - Толщина: тонкая / средняя / толстая.
  - Undo / Redo (только в текущей сессии, до отправки).
- Валидация:
  - Минимальная длина/размер для линий/фигур.
  - Пустой текст не сохраняется.

## Preview Generation
- Основной путь: в браузере берём кадр из плеера, рисуем SVG поверх, генерим PNG.
- PNG загружается в S3 как публичный объект; URL пишется в `annotationPreview`.
- Fallback: если кадр из плеера недоступен (CORS/iframe), сервер получает thumbnail по timecode из Kinescope API и накладывает SVG.
- Если превью не удалось получить — комментарий всё равно создаётся, но `annotationPreview` остаётся пустым.

## Portal Behavior
- При отправке комментария:
  - сохраняем `annotationData` и `annotationPreview`.
  - `timecodeSec` привязан к моменту входа в режим аннотации.
- Клик по комментарию с аннотацией:
  - видео прыгает на `timecodeSec` и показывает оверлей аннотации.

## Dashboard Behavior
- На странице версии (`projects/[id]/versions/[versionId]`) в списке комментариев отображается превью.
- Клик по карточке:
  - переход на таймкод;
  - показ оверлея аннотации поверх кадра.

## API / Validation
- `/api/public/feedback` принимает `annotationData` и `annotationPreview`.
- Валидация:
  - структура `annotationData`.
  - координаты `0..1`.
  - `tenantId` обязателен во всех запросах/сервисах.
- Роли UI: только OWNER и EDITOR.

## Testing
- Unit: валидатор `annotationData` (типы, диапазоны, обязательные поля).
- Service/API: создание `FeedbackItem` с `annotationData` и `annotationPreview`.
- UI: отображение превью/оверлея, Undo/Redo, переход к таймкоду по клику.

## Out of Scope
- Изменение `AITask`, `ScopeDecision`, `WorkflowStage`, `Subscription`, `Notification`.
- Роль PM и UI для неё.
