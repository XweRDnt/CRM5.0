# Floating Annotation Toolbar — Design Spec (Mobile-First)

Date: 2026-03-15
Owner: Codex
Scope: client portal annotation UI in `app/client-portal/[token]/page.tsx`

## Summary
Introduce a floating, always-visible (when annotation mode is enabled) drawing toolbar optimized for mobile. The toolbar sits bottom-center over the video overlay, supports all drawing tools, color, thickness, undo/redo, and a send action. Comment text becomes optional when an annotation drawing exists. The design is compact, dark, and avoids covering core video content.

## Goals
- Mobile-first floating toolbar with clear active states and minimal occlusion.
- Support full annotation toolset: arrow, rect, ellipse, line, freehand, text.
- Inline controls for color, thickness, undo/redo, and send.
- Allow submitting annotations without a required comment text.
- Smooth appearance/disappearance animation and high z-index above overlay.

## Non-goals
- No new annotation types or storage schema changes.
- No changes to backend payload format.
- No drag-to-move toolbar (can be added later if needed).

## UX Layout
- **Position:** bottom-center, above safe-area and player controls.
- **Form factor:** pill-like container with rounded corners and compact height.
- **Rows:**
  - Row 1: tool icons + undo/redo + send.
  - Row 2 (compact): color and thickness chips; collapsible on very small screens.
- **Visibility:** only when `annotationMode === true`.
- **Overlay:** toolbar captures pointer events; overlay remains interactive for drawing.

## Interaction Rules
- Tool selection toggles active state and updates drawing behavior.
- Undo/redo enabled state reflects `annotationStrokes` / `redoStrokes` length.
- Send action triggers `submitFeedback`.
- Text tool uses existing in-canvas input, returning focus to toolbar after commit.

## Validation & Submit Logic
- `commentText` is optional.
- Submit is enabled when:
  - `authorName` is non-empty AND
  - (`commentText` has content OR `annotationStrokes.length > 0`)
- On submit:
  - If `commentText` empty, send payload without `text` or with empty string (to be decided in implementation; prefer empty string to avoid schema changes).
  - If annotations exist, include `annotationData` and attempt preview generation.

## Visual Style
- Dark theme: near-black background with subtle border and shadow.
- High contrast active tool state.
- Tap targets ~44px for mobile accuracy.
- Animated entrance/exit: 150–200ms fade + slight slide.

## Accessibility
- Buttons have `aria-label` where icon-only.
- Visible focus state for keyboard (desktop fallback).
- Disabled states clearly dimmed.

## Error Handling
- Existing submit error toasts remain.
- Annotation preview generation remains best-effort, failure is silent.

## Testing Checklist
- Mobile viewport: toolbar visible and does not overlap system gesture area.
- Annotation drawing for all tools works with toolbar visible.
- Undo/redo enable/disable logic correct.
- Submit works with:
  - name only + drawing
  - name only + text
  - name + text + drawing
- No regression in non-annotation playback.

## Implementation Notes
- Replace existing top-left toolbar with new floating toolbar container.
- Ensure `z-index` above overlay (`z-40` or higher).
- Use Tailwind utility classes consistent with current theme.
- Keep changes localized to `page.tsx` unless extraction is needed.
