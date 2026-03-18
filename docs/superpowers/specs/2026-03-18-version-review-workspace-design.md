# Version Review Workspace Design Spec

**Date:** 2026-03-18
**Scope:** Internal PM version review workspace redesign
**Primary Files:** `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`, `app/(dashboard)/layout.tsx`, `components/layout/Header.tsx`

## Summary
Redesign the internal project version page into a more premium PM review workspace. Remove the generic welcome header from this route, give the video stage correct visual priority and aspect ratio, and turn the feedback column into a clearer, denser review panel. Keep the existing data flow, actions, SWR usage, and Kinescope integration intact.

## Goals
- Remove the top "welcome / user / logout" header from the version review route.
- Reframe the page as an immersive PM workspace rather than a generic dashboard card layout.
- Make the player area feel large, intentional, and correctly proportioned.
- Upgrade the feedback panel so cards read faster and feel like review threads instead of CRM tiles.
- Preserve all current actions: version switching, public portal actions, delete version, timecode seek, annotation overlay.

## Non-Goals
- No API contract changes.
- No Kinescope player behavior changes beyond layout and surrounding presentation.
- No reply-thread backend implementation.
- No broad redesign of unrelated dashboard pages.

## UX Direction
- Visual direction: premium, focused, quiet, dark PM workspace.
- Layout priority: video first, comments second, chrome third.
- Tone: less purple glass, more graphite / ink / muted blue with restrained accents.
- Sidebar remains, but the workspace should dominate visually.

## Screen Structure
1. **Route-level workspace shell**
   - Hide the shared dashboard header on this route only.
   - Keep sidebar visible.
   - Let the page own its full vertical composition.
2. **Workspace top section**
   - Row 1: project title, version, status, correction signal.
   - Row 2: version tabs and PM actions.
3. **Main split**
   - Left: video stage, metadata, compact metrics, export action.
   - Right: sticky review panel with filters and comment threads.

## Header Behavior
- The shared `Header` should not render on this route.
- Logout remains available elsewhere in the dashboard; this page does not need the welcome bar.
- The page-specific top bar should feel embedded into the workspace, not like app chrome.

## Video Stage
- Increase stage height and preserve an uncompromised aspect ratio.
- Use a dedicated stage container with stronger depth, edge treatment, and breathing room.
- Move file metadata into a cleaner supporting row under the player.
- Keep annotation overlay and timecode behavior unchanged.
- Processing-state messaging remains below the stage when needed.

## Metrics and Utility Actions
- Replace generic equal-weight stat blocks with a more refined compact summary strip.
- Keep XML export secondary in hierarchy.
- The left column should feel editorial and uncluttered, not widget-heavy.

## Review Panel
- Add a stronger panel identity for the comments column.
- Filters should stay sticky and easy to scan.
- Each comment card should clearly separate:
  - author
  - timecode chip
  - comment body
  - annotation presence
  - status badge
  - replies indicator
- Unread/new items should have a subtle but obvious visual marker.
- Expanded state should feel like a thread container, not a collapsing form stub.

## Interaction Rules
- Existing feedback filtering remains client-side.
- Timecode chip still seeks the player and shows annotations.
- Clicking a card still toggles expansion.
- Reply input stays disabled for users without permission.

## Implementation Notes
- Prefer route-based conditional rendering in `app/(dashboard)/layout.tsx` to hide the shared header only for this path.
- Keep logic in the current page unless a small extraction materially improves readability.
- Clean up styling so the page is not a flat dump of unrelated utility classes.
- Do not change existing SWR keys, mutation flow, or endpoint usage.

## Testing
- Run ESLint on modified files.
- Run TypeScript typecheck, but note the existing project-wide `FeedbackStatus` mismatch if it still blocks green status.
- Manually verify:
  - header hidden on version page only
  - player remains correctly proportioned
  - sidebar still works
  - filters still work
  - timecode seek still works
  - annotation overlay still renders

## Risks
- Hiding the shared header at layout level could affect sibling routes if the route match is too broad.
- The page file is already large; the redesign should avoid making it harder to maintain.
- Aggressive visual styling can regress mobile layout if the split view is not rebalanced carefully.
