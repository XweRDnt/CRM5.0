# Annotation Visibility Bound to Timecode — Design Spec

Date: 2026-03-15
Owner: Codex
Scope: client portal annotation visibility behavior in `app/client-portal/[token]/page.tsx`

## Summary
Ensure that a selected annotation is shown only when playback is paused at its exact (or near) timecode, and it is automatically hidden as soon as playback starts. This keeps annotations strictly tied to a frame.

## Goals
- Hide active annotation immediately on `play`.
- Show annotation only when paused and the current time matches the annotation timecode.
- Keep annotation hidden while `annotationMode` is enabled.

## Non-goals
- No changes to annotation storage schema.
- No new UI components.
- No changes to drawing tools.

## Behavior
- When a comment is clicked, store its annotation data + timecode as the “selected annotation”.
- On `play`: hide any visible annotation immediately.
- On `pause` or `seek`: if paused and current time is within a small window of the selected timecode (e.g., ±1s), show the annotation; otherwise hide it.
- While `annotationMode` is true, do not show selected annotations.

## Edge Cases
- If the selected feedback has no `timecodeSec`, do not auto-show on pause.
- If there is no selected annotation, do nothing.

## Accessibility
No changes.

## Testing Checklist
- Click a feedback item at time T > annotation shows.
- Press play > annotation hides immediately.
- Pause at time T (±1s) > annotation reappears.
- Pause at other time > annotation stays hidden.
- Enter annotation mode > annotation stays hidden.

## Implementation Notes
- Track `isPlayerPlaying` in state via `onPlay`/`onPause`.
- Track `selectedAnnotation` with `timecodeSec` + data.
- Add effect to sync visibility based on play state, time, and annotation mode.
