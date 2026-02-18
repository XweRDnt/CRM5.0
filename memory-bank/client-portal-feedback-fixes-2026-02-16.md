# Client Portal + Feedback Fix Notes (2026-02-16)

## Scope
- Page: `/client-portal/[token]`
- Page: `/projects/[id]`
- Page: `/projects/[id]/feedback`

## Final UX behavior
- Feedback form fields on portal: `name + timecode + comment` (email removed).
- Timecode is captured by button from current video position.
- Button pauses video before final time capture.
- Project page uses one link labeled `Public Feedback Link` that points to `/client-portal/{versionId}`.
- Feedback time display uses formatted values (`m:ss` / `h:mm:ss`), not raw seconds (`t=533s`).

## Files changed
- `app/client-portal/[token]/page.tsx`
- `components/feedback/feedback-form.tsx`
- `components/feedback/FeedbackForm.tsx`
- `components/feedback/feedback-item.tsx`
- `app/(dashboard)/projects/[id]/page.tsx`
- `lib/hooks/useYouTubePlayer.ts`

## Critical bugs and root causes
1. YouTube did not load in portal.
- Cause: YouTube URLs were rendered in native `<video>`.
- Fix: Use YouTube player component for `youtube.com` / `youtu.be` URLs.

2. Hook order runtime error in portal page.
- Error: change in order of Hooks called by `ClientPortalPage`.
- Cause: `useEffect` was placed after conditional returns.
- Fix: Move all hooks/effects above early-return branches.

3. `getCurrentTime is not a function` in YouTube runtime.
- Cause: constructor return from `new YT.Player(...)` is not always a full API object.
- Fix: canonical player instance must be `onReady(event.target)`.

4. Timestamp capture intermittently became `0:00`.
- Causes:
  - unstable YouTube `getCurrentTime()` values;
  - fallback logic accepted `0` as valid and skipped backup value.
- Fix:
  - maintain `lastKnownTimeRef`;
  - poll current time while player is ready;
  - on capture use: `max(directTime, lastKnownTimeRef, playerCurrentTimeSec)`;
  - pause first, then read time with short delay.

## Troubleshooting checklist (quick)
1. Confirm portal URL is `/client-portal/{versionId}`.
2. Confirm YouTube URL is rendered by `YouTubePlayer`, not native `<video>`.
3. Confirm `playerReady` becomes true before enabling capture button.
4. Confirm `useYouTubePlayer` sets `playerRef` from `onReady(event.target)`.
5. Confirm capture logic uses fallback max from three sources.
6. Hard refresh page (`Ctrl+F5`) after player hook changes.

## Fast validation commands
```bash
npm.cmd run -s typecheck
npm.cmd run -s test -- lib/hooks/__tests__/useYouTubePlayer.test.ts components/video/__tests__/YouTubePlayer.test.tsx
```
