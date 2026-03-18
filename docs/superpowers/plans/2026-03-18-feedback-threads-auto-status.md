# Feedback Threads And Auto-Statuses Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить треды внутри карточек правок и перевести статусы правок на полностью автоматические серверные переходы без ручного управления.

**Architecture:** `FeedbackItem` остаётся основной сущностью правки, а сообщения треда и read-state выносятся в отдельные таблицы. UI на dashboard и client portal получает accordion для конкретной правки, а auto-status обновляется через явные серверные точки интеграции: создание правки, загрузка страницы, XML export, загрузка новой версии.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, SWR, Vitest, Testing Library, existing toast/auth/api utilities.

---

## File Map
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_feedback_threads_and_reads/migration.sql`
- Modify: `types/index.ts`
- Modify: `lib/services/feedback.service.ts`
- Modify: `app/api/projects/[id]/feedback/route.ts`
- Create: `app/api/feedback/[id]/thread/route.ts`
- Create: `app/api/feedback/[id]/thread/read/route.ts`
- Create: `app/api/public/feedback/[id]/thread/route.ts`
- Create: `app/api/public/feedback/[id]/thread/read/route.ts`
- Modify: `app/api/public/feedback/route.ts`
- Modify: `app/api/projects/[id]/versions/route.ts`
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`
- Modify: `app/client-portal/[token]/page.tsx`
- Create: `components/feedback/FeedbackThread.tsx`
- Create: `components/feedback/FeedbackThreadComposer.tsx`
- Create: `components/feedback/FeedbackThreadMessageList.tsx`
- Test: `tests/api/feedback-thread.test.ts`
- Test: `tests/api/feedback-auto-status.test.ts`
- Test: `components/feedback/__tests__/FeedbackThread.test.tsx`

## Chunk 1: Schema And Types

### Task 1: Add failing API test coverage for thread reads and posting permissions
**Files:**
- Create: `tests/api/feedback-thread.test.ts`
- Reuse: `tests/api/helpers.ts`
- Reuse: `tests/factories/*.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("allows owner to post in feedback thread and returns unread count", async () => {
  // create tenant, project, version, feedback
  // POST /api/feedback/:id/thread
  // GET /api/projects/:id/feedback
  // expect threadUnreadCount > 0 for another user
});

it("rejects editor from posting in feedback thread", async () => {
  // expect 403
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/feedback-thread.test.ts`
Expected: FAIL because thread routes/models do not exist yet.

- [ ] **Step 3: Add Prisma schema changes**

```prisma
model FeedbackThreadMessage {
  id             String   @id @default(cuid())
  feedbackItemId String
  authorType     AuthorType
  authorUserId   String?
  authorName     String
  authorRoleLabel String
  text           String
  createdAt      DateTime @default(now())
  feedbackItem   FeedbackItem @relation(fields: [feedbackItemId], references: [id], onDelete: Cascade)
  authorUser     User?    @relation("FeedbackThreadAuthor", fields: [authorUserId], references: [id])
}

model FeedbackThreadRead {
  id             String   @id @default(cuid())
  feedbackItemId String
  userId         String?
  clientIdentity String?
  lastReadAt     DateTime
}
```

- [ ] **Step 4: Add migration and generated types**

Run:
```bash
npx prisma migrate dev --name add_feedback_threads_and_reads
npx prisma generate
```

Expected: migration file created and Prisma client updated.

- [ ] **Step 5: Extend shared app types**

Update `types/index.ts` with:
- `FeedbackThreadMessageResponse`
- `FeedbackThreadMeta`
- `FeedbackThreadReadRequest`

- [ ] **Step 6: Run targeted verification**

Run:
```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations types/index.ts tests/api/feedback-thread.test.ts
git commit -m "feat: add feedback thread schema"
```

## Chunk 2: Service And Dashboard API

### Task 2: Add service methods for thread CRUD and unread metadata
**Files:**
- Modify: `lib/services/feedback.service.ts`
- Modify: `app/api/projects/[id]/feedback/route.ts`
- Create: `app/api/feedback/[id]/thread/route.ts`
- Create: `app/api/feedback/[id]/thread/read/route.ts`

- [ ] **Step 1: Extend failing tests for service-backed routes**

Add expectations for:
- `GET /api/feedback/:id/thread`
- `POST /api/feedback/:id/thread/read`
- expanded metadata in `GET /api/projects/:id/feedback`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/feedback-thread.test.ts`
Expected: FAIL on 404/shape mismatch.

- [ ] **Step 3: Implement minimal service methods**

Add methods in `FeedbackService`:
- `listThreadMessages`
- `createThreadMessage`
- `markThreadRead`
- `listFeedbackByProjectWithThreadMeta`

Keep unread calculation server-side based on current viewer identity.

- [ ] **Step 4: Implement dashboard routes**

Create route handlers:
- `GET/POST /api/feedback/[id]/thread`
- `POST /api/feedback/[id]/thread/read`

Rules:
- `OWNER|PM` may post
- `EDITOR` gets `403`
- all authenticated project members may read and mark as read

- [ ] **Step 5: Update project feedback list route**

Return existing feedback payload plus:
- `threadMessageCount`
- `threadUnreadCount`
- `lastThreadMessageAt`
- `lastThreadMessagePreview`

- [ ] **Step 6: Run verification**

Run:
```bash
npm test -- tests/api/feedback-thread.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/services/feedback.service.ts app/api/projects/[id]/feedback/route.ts app/api/feedback/[id]/thread app/api/feedback/[id]/thread/read tests/api/feedback-thread.test.ts
git commit -m "feat: add dashboard feedback thread api"
```

## Chunk 3: Public Portal Thread API

### Task 3: Add client thread routes and client read identity
**Files:**
- Create: `app/api/public/feedback/[id]/thread/route.ts`
- Create: `app/api/public/feedback/[id]/thread/read/route.ts`
- Reuse: `app/api/public/portal/[token]/route.ts`
- Modify: `lib/services/feedback.service.ts`

- [ ] **Step 1: Write failing portal thread tests**

```ts
it("allows portal client to post thread reply with valid token", async () => {
  // expect 201
});

it("rejects portal thread access with mismatched token", async () => {
  // expect 404/403
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/feedback-thread.test.ts`
Expected: FAIL on missing public routes.

- [ ] **Step 3: Implement client identity resolution**

Use stable key derived from portal token plus available author identity.

- [ ] **Step 4: Implement public routes**

Create:
- `GET /api/public/feedback/[id]/thread`
- `POST /api/public/feedback/[id]/thread`
- `POST /api/public/feedback/[id]/thread/read`

- [ ] **Step 5: Verify**

Run:
```bash
npm test -- tests/api/feedback-thread.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/public/feedback/[id]/thread app/api/public/feedback/[id]/thread/read lib/services/feedback.service.ts tests/api/feedback-thread.test.ts
git commit -m "feat: add portal feedback thread api"
```

## Chunk 4: Auto-Status Server Logic

### Task 4: Add failing tests for automatic feedback status transitions
**Files:**
- Create: `tests/api/feedback-auto-status.test.ts`
- Modify: `app/api/public/feedback/route.ts`
- Modify: `app/api/projects/[id]/versions/route.ts`
- Modify: `lib/services/feedback.service.ts`

- [ ] **Step 1: Write the failing test**

Cover:
- client-created feedback starts as `NEW`
- dashboard page view marks version feedback `VIEWED`
- XML export marks active version feedback `IN_PROGRESS`
- new version upload marks previous version feedback `RESOLVED`
- thread message does not change status

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/feedback-auto-status.test.ts`
Expected: FAIL because transition helpers do not exist.

- [ ] **Step 3: Implement transition helpers in service**

Add minimal methods:
- `markVersionFeedbackViewed`
- `markVersionFeedbackInProgress`
- `resolvePreviousVersionFeedback`

- [ ] **Step 4: Wire existing product triggers**

Use:
- current public feedback creation route for `NEW`
- dedicated dashboard action/read route for `VIEWED`
- XML export path on PM screen for `IN_PROGRESS`
- version creation route for `RESOLVED`

- [ ] **Step 5: Verify**

Run:
```bash
npm test -- tests/api/feedback-auto-status.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/public/feedback/route.ts app/api/projects/[id]/versions/route.ts lib/services/feedback.service.ts tests/api/feedback-auto-status.test.ts
git commit -m "feat: automate feedback status transitions"
```

## Chunk 5: Shared Thread UI Components

### Task 5: Build reusable accordion thread UI with TDD
**Files:**
- Create: `components/feedback/FeedbackThread.tsx`
- Create: `components/feedback/FeedbackThreadComposer.tsx`
- Create: `components/feedback/FeedbackThreadMessageList.tsx`
- Create: `components/feedback/__tests__/FeedbackThread.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
it("expands inline, renders messages, unread badge, and hides composer for editor", () => {
  // render collapsed
  // click card
  // expect message list and composer/read-only state
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/feedback/__tests__/FeedbackThread.test.tsx`
Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement minimal shared components**

Behavior:
- accordion by click
- unread badge
- avatar/name/role/text/time
- composer only for allowed roles

- [ ] **Step 4: Verify**

Run:
```bash
npm test -- components/feedback/__tests__/FeedbackThread.test.tsx
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/feedback components/feedback/__tests__/FeedbackThread.test.tsx
git commit -m "feat: add feedback thread ui components"
```

## Chunk 6: PM Version Page Integration

### Task 6: Replace local thread stub on the PM version page
**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`
- Reuse: `components/feedback/FeedbackThread.tsx`

- [ ] **Step 1: Extend failing UI test or add route-aware integration test**

Cover:
- card click expands accordion
- `threadUnreadCount` badge renders
- `OWNER|PM` can type
- `EDITOR` cannot type

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/feedback/__tests__/FeedbackThread.test.tsx`
Expected: FAIL on integration assumptions.

- [ ] **Step 3: Integrate PM page**

Wire:
- lazy-load thread messages on open
- mark as read on open
- call auto-viewed action when list becomes visible after load
- call in-progress action from XML export handler

- [ ] **Step 4: Verify**

Run:
```bash
npm test -- components/feedback/__tests__/FeedbackThread.test.tsx
npx eslint 'app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx'
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add 'app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx'
git commit -m "feat: integrate feedback threads into pm review page"
```

## Chunk 7: Client Portal Integration

### Task 7: Add the same thread experience to the public portal
**Files:**
- Modify: `app/client-portal/[token]/page.tsx`
- Reuse: `components/feedback/FeedbackThread.tsx`

- [ ] **Step 1: Add failing portal UI test**

Cover:
- client opens feedback card
- sees thread history
- can send reply
- unread clears when card opens

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/__tests__/client-portal-mobile-annotations.test.tsx`
Expected: FAIL or missing coverage for thread behavior.

- [ ] **Step 3: Integrate portal thread UI**

Use portal thread endpoints, preserve current annotation submission flow, keep original feedback creation unchanged.

- [ ] **Step 4: Verify**

Run:
```bash
npm test -- components/__tests__/client-portal-mobile-annotations.test.tsx
npx eslint 'app/client-portal/[token]/page.tsx'
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add 'app/client-portal/[token]/page.tsx'
git commit -m "feat: add feedback threads to client portal"
```

## Chunk 8: Final Verification

### Task 8: Run focused regression suite and document outcomes
**Files:**
- Modify: `docs/superpowers/specs/2026-03-18-feedback-threads-auto-status-design.md` only if behavior changed during implementation

- [ ] **Step 1: Run targeted tests**

Run:
```bash
npm test -- tests/api/feedback-thread.test.ts
npm test -- tests/api/feedback-auto-status.test.ts
npm test -- components/feedback/__tests__/FeedbackThread.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run static verification**

Run:
```bash
npx eslint 'app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx' 'app/client-portal/[token]/page.tsx' 'lib/services/feedback.service.ts'
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Sanity-check critical user flows manually**

Verify:
- client creates feedback
- PM sees it as new
- PM opens page and feedback becomes viewed
- PM/client exchange thread messages
- XML export moves statuses in progress
- new version upload resolves previous feedback

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: ship feedback threads and auto statuses"
```
