# Design: Remove Non-Kinescope Video Providers

## Summary
Remove all non-Kinescope video provider support across schema, API, services, UI, and tests. The system should always use Kinescope as the only provider. Client payloads must no longer send `videoProvider`; server-side code should hardcode `KINESCOPE`.

## Goals
- Keep only `KINESCOPE` in `VideoProvider`.
- Remove all `EXTERNAL_URL` and `YOUTUBE_LEGACY` branches from code.
- Eliminate `videoProvider` from API inputs and client payloads.
- Keep migrations safe after production data cleanup (confirmed non-Kinescope entries removed).

## Non-Goals
- No UI redesigns or unrelated refactors.
- No changes to billing, roles, or unrelated services.

## Scope
- Prisma schema and migration.
- API handlers that accept or return `videoProvider`.
- Services and types that branch on provider.
- Client portal rendering logic.
- Tests referencing non-Kinescope providers.

## Design

### Schema
- `enum VideoProvider` contains only `KINESCOPE`.
- `AssetVersion.videoProvider` default set to `KINESCOPE`.
- Migration `remove_non_kinescope_providers` updates the enum.

### API
- Remove `videoProvider` from request payload validation in `POST /api/projects/[id]/versions`.
- Server sets `videoProvider: VideoProvider.KINESCOPE` unconditionally.
- Response still includes `videoProvider` (as `KINESCOPE`) for compatibility unless a follow-up change removes it from response DTOs.

### Services
- Remove branches that handle non-Kinescope providers.
- Simplify file URL construction and validation to Kinescope-only.
- Require `kinescopeVideoId` where needed; remove fallbacks to `fileUrl` for non-Kinescope.

### Client Portal
- Update `videoProvider` typing to only `KINESCOPE`.
- Remove any non-Kinescope switch cases or conditional rendering.

### Types
- Update shared types to reflect single provider.
- Remove any union types that include non-Kinescope values.

### Tests
- Remove or update test cases that set `EXTERNAL_URL` or `YOUTUBE_LEGACY`.

## Data/Migration Plan
- Production data already cleaned (non-Kinescope rows removed).
- Apply migration that replaces enum to only `KINESCOPE`.

## Error Handling
- If any request attempts to pass `videoProvider`, validation should reject it or ignore it based on updated schema.
- Service-level safeguards assume Kinescope-only and should not accept missing `kinescopeVideoId`.

## Rollout
- Merge and deploy.
- Run migration.
- Monitor for any unexpected provider-related errors.

## Test Plan
- Unit tests for services still pass with Kinescope-only.
- API handler rejects/ignores `videoProvider` in payload and sets `KINESCOPE`.
- Client portal renders video without provider branching.
