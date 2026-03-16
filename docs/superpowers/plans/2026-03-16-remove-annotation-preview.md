# Remove Annotation Preview Everywhere Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove annotation preview images from UI and stop returning `annotationPreview` in API payloads.

**Architecture:** Strip the preview field from API responses and server/service types; remove preview rendering in admin UI; leave database column untouched.

**Tech Stack:** Next.js App Router, Prisma, TypeScript, Tailwind CSS.

---

## Chunk 1: Remove preview from UI and API

### Task 1: Remove preview rendering and payload fields

**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`
- Modify: `app/api/public/portal/[token]/route.ts`
- Modify: `app/api/public/feedback/route.ts`
- Modify: `app/client-portal/[token]/page.tsx`
- Modify: `types/index.ts`
- Modify: `lib/services/feedback.service.ts`

- [ ] **Step 1: Update admin UI to remove preview block**

```tsx
// Remove the button/img block that renders item.annotationPreview
```

- [ ] **Step 2: Remove annotationPreview from public portal API select and response**

```ts
// Drop annotationPreview from Prisma select + response mapping
```

- [ ] **Step 3: Remove annotationPreview from public feedback schema and create/select**

```ts
// Remove field from Zod schema and Prisma create/select
```

- [ ] **Step 4: Remove annotationPreview from portal/client types**

```ts
// Drop field from PortalFeedbackItem and shared types
```

- [ ] **Step 5: Remove annotationPreview from feedback service mapping**

```ts
// Drop from FeedbackWithAuthor, create payload, and mapFeedbackResponse
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx app/api/public/portal/[token]/route.ts app/api/public/feedback/route.ts app/client-portal/[token]/page.tsx types/index.ts lib/services/feedback.service.ts
git commit -m "chore: remove annotation preview from ui and api"
```
