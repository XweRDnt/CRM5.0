# Remove Non-Kinescope Providers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all non-Kinescope video provider support across schema, API, services, UI, and tests.

**Architecture:** Keep `VideoProvider` as a single-value enum (`KINESCOPE`) and hardcode server-side provider assignment. Client and API no longer accept or branch on provider.

**Tech Stack:** Next.js App Router, Prisma, TypeScript, Vitest.

---

## Chunk 1: Schema And Types

### Task 1: Update Prisma Enum And Defaults

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing test**

Add a minimal schema validation test if one exists in the codebase for enums; otherwise skip and document why.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- <path-to-test>`
Expected: FAIL due to enum mismatch.

- [ ] **Step 3: Update schema to Kinescope-only**

```prisma
enum VideoProvider {
  KINESCOPE
}

model AssetVersion {
  videoProvider VideoProvider @default(KINESCOPE)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- <path-to-test>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "chore(prisma): keep only KINESCOPE provider"
```

### Task 2: Update Shared Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Write the failing test**

If type-level tests exist, add a minimal test for `VideoProvider` shape; otherwise skip and document why.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- <path-to-test>`
Expected: FAIL due to type mismatch.

- [ ] **Step 3: Update types to Kinescope-only**

Ensure any unions include only `KINESCOPE`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- <path-to-test>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "chore(types): restrict VideoProvider to KINESCOPE"
```

## Chunk 2: Server API And Services

### Task 3: Remove Provider From Versions API Input

**Files:**
- Modify: `app/api/projects/[id]/versions/route.ts`

- [ ] **Step 1: Write the failing test**

Add/extend API handler test to ensure payload with `videoProvider` is rejected or ignored and server writes `KINESCOPE`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- <path-to-test>`
Expected: FAIL.

- [ ] **Step 3: Update handler**

Remove `videoProvider` from `zod` schema and set `videoProvider: VideoProvider.KINESCOPE` server-side.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- <path-to-test>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/versions/route.ts
git commit -m "chore(api): hardcode Kinescope provider"
```

### Task 4: Simplify Asset Service Provider Logic

**Files:**
- Modify: `lib/services/asset.service.ts`

- [ ] **Step 1: Write the failing test**

Update existing service tests to drop `EXTERNAL_URL` cases and require `KINESCOPE` with `kinescopeVideoId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- lib/services/__tests__/asset.service.test.ts`
Expected: FAIL on removed provider branches.

- [ ] **Step 3: Update service logic**

Remove non-Kinescope branches, enforce Kinescope-only validation, simplify `fileKey` and `streamUrl` logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- lib/services/__tests__/asset.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/asset.service.ts lib/services/__tests__/asset.service.test.ts
git commit -m "chore(asset): remove non-Kinescope branches"
```

## Chunk 3: Client And Remaining Tests

### Task 5: Update Client Portal Provider Typing

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Write the failing test**

If client portal tests reference provider unions, adjust/extend them to expect Kinescope-only.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- components/__tests__/client-portal-mobile-annotations.test.tsx`
Expected: FAIL if provider union is still broad.

- [ ] **Step 3: Update client portal typing and branches**

Restrict `videoProvider` to `KINESCOPE` and remove any provider switching logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- components/__tests__/client-portal-mobile-annotations.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/client-portal/[token]/page.tsx components/__tests__/client-portal-mobile-annotations.test.tsx
git commit -m "chore(portal): drop non-Kinescope provider cases"
```

### Task 6: Clean Remaining Provider References

**Files:**
- Modify: `lib/services/__tests__/project.service.test.ts`
- Modify: `lib/services/__tests__/kinescope.service.test.ts`
- Modify: Any other files found by search

- [ ] **Step 1: Write the failing test**

Update any remaining tests that mention `EXTERNAL_URL` or `YOUTUBE_LEGACY`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- <updated-test-path>`
Expected: FAIL on stale provider values.

- [ ] **Step 3: Update tests and any remaining references**

Remove non-Kinescope values and align fixtures to Kinescope-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- <updated-test-path>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/__tests__/project.service.test.ts lib/services/__tests__/kinescope.service.test.ts
git commit -m "chore(tests): remove non-Kinescope provider fixtures"
```

## Chunk 4: Migration

### Task 7: Create Prisma Migration

**Files:**
- Create: `prisma/migrations/*_remove_non_kinescope_providers/*`

- [ ] **Step 1: Run migration**

Run: `npm.cmd exec -- prisma migrate dev --name remove_non_kinescope_providers`
Expected: New migration created.

- [ ] **Step 2: Inspect migration SQL**

Ensure enum is recreated with only `KINESCOPE` and default updated accordingly.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "chore(prisma): migrate to Kinescope-only provider"
```

## Chunk 5: Final Sweep

### Task 8: Global Search Verification

**Files:**
- Verify: project-wide search for `EXTERNAL_URL` and `YOUTUBE_LEGACY`

- [ ] **Step 1: Search**

Run: `rg -n "EXTERNAL_URL|YOUTUBE_LEGACY" -S app lib components types prisma`
Expected: No matches.

- [ ] **Step 2: Commit (if any last fixes)**

```bash
git add -A
git commit -m "chore: remove remaining non-Kinescope references"
```
