# Design: Delete Kinescope Videos When Deleting Project

Date: 2026-03-12

## Goal
When a project is deleted, remove all related Kinescope videos first (best-effort), then delete the project in the database. Kinescope failures must not block project deletion; they should be logged to console.error.

## Scope
- **In scope:** ProjectService.deleteProject behavior, Kinescope delete calls for all AssetVersions with kinescopeVideoId and ideoProvider = KINESCOPE.
- **Out of scope:** AuditLog, queues, retries/backoff, UI changes.

## Current State
- Deleting a single version already calls getKinescopeService().deleteVideo(kinescopeVideoId) before deleting the DB row (see AssetService.deleteVersion).
- Project deletion currently deletes DB records without touching Kinescope videos.

## Proposed Behavior
1. Fetch all AssetVersions for the project where:
   - ideoProvider = KINESCOPE
   - kinescopeVideoId IS NOT NULL
2. For each version, call getKinescopeService().deleteVideo(kinescopeVideoId).
3. If a Kinescope delete fails, log:
   - projectId, ersionId, kinescopeVideoId, and error message
   - continue to next version
4. Delete the project from the database after processing all Kinescope deletions.

## Data Flow
- Input: projectId, 	enantId (from ServiceContext).
- Query: Prisma ssetVersion.findMany for the project + tenant constraint via project relation.
- Side-effect: Kinescope API deletion (best-effort).
- DB delete: existing project deletion logic.

## Error Handling
- **Kinescope errors:** caught and logged, do not stop deletion.
- **Project not found / access violation:** same behavior as current implementation (error out).

## Testing (TDD)
Add tests in lib/services/__tests__/project.service.test.ts:
- Deletes all Kinescope videos for project versions with kinescopeVideoId.
- Skips non‑Kinescope versions.
- If Kinescope delete throws, logs and still deletes project.

Mock getKinescopeService().deleteVideo similarly to AssetService tests.

## Rollout Notes
No migration required. No API contract change. Only service behavior.