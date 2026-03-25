# Demo Read-Only Link Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/demo/[token]` entrypoint that opens the existing client portal in strict read-only mode for one preconfigured demo project without login and without any database writes.

**Architecture:** Reuse the existing `portalToken` public portal instead of adding new auth or a separate demo domain model. Add a tiny demo route, a shared `isDemoToken` helper, a portal-side `readonly` mode, and server-side guards in all public mutating routes so demo traffic cannot create any writes even if UI protections are bypassed.

**Tech Stack:** Next.js App Router, TypeScript, existing public portal API routes, Vitest

---

## Chunk 1: Config and Token Helper

### Task 1: Add demo environment variables

**Files:**
- Modify: `/.env.example`

- [ ] **Step 1: Add the failing expectation in an env-related smoke test if one exists**

Search for an existing config or env coverage test. If none exists, skip creating a new one for this env-only change.

- [ ] **Step 2: Update `.env.example` with demo variables**

Add:

```dotenv
DEMO_PROJECT_ID=""
DEMO_PORTAL_TOKEN=""
```

Keep them near other app-level runtime variables and avoid changing unrelated values.

- [ ] **Step 3: Run the focused verification**

Run: `npm run lint -- .env.example`

Expected: either no-op success or skip if lint does not cover `.env.example`

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add demo portal env variables"
```

### Task 2: Add shared demo token helper

**Files:**
- Create: `/lib/utils/demo-token.ts`
- Test: `/lib/utils/__tests__/demo-token.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import { isDemoToken } from "@/lib/utils/demo-token";

describe("isDemoToken", () => {
  it("returns true only for the configured demo portal token", () => {
    process.env.DEMO_PORTAL_TOKEN = "demo-secret";
    expect(isDemoToken("demo-secret")).toBe(true);
    expect(isDemoToken("other-token")).toBe(false);
  });

  it("returns false when the env token is missing", () => {
    delete process.env.DEMO_PORTAL_TOKEN;
    expect(isDemoToken("demo-secret")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/utils/__tests__/demo-token.test.ts`

Expected: FAIL because helper file does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function isDemoToken(token: string): boolean {
  const configuredToken = process.env.DEMO_PORTAL_TOKEN;
  if (!configuredToken) {
    return false;
  }

  return token === configuredToken;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/utils/__tests__/demo-token.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/demo-token.ts lib/utils/__tests__/demo-token.test.ts
git commit -m "feat: add demo token helper"
```

## Chunk 2: Public Demo Route

### Task 3: Add `/demo/[token]` redirect route

**Files:**
- Create: `/app/demo/[token]/page.tsx`
- Test: `/app/demo/[token]/page.test.tsx` or route-level equivalent if project uses server component tests

- [ ] **Step 1: Write the failing route test**

Cover:
- invalid token returns not-found behavior
- valid token redirects to `/client-portal/[token]?readonly=true`

Example expectation:

```ts
expect(redirect).toHaveBeenCalledWith("/client-portal/demo-secret?readonly=true");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/demo/[token]/page.test.tsx`

Expected: FAIL because route does not exist yet

- [ ] **Step 3: Implement minimal route**

Implementation shape:

```ts
import { notFound, redirect } from "next/navigation";
import { isDemoToken } from "@/lib/utils/demo-token";

export default async function DemoRedirectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isDemoToken(token)) {
    notFound();
  }

  redirect(`/client-portal/${token}?readonly=true`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- app/demo/[token]/page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/demo/[token]/page.tsx app/demo/[token]/page.test.tsx
git commit -m "feat: add public demo redirect route"
```

## Chunk 3: Client Portal Read-Only Mode

### Task 4: Teach the client portal to read `readonly=true`

**Files:**
- Modify: `/app/client-portal/[token]/page.tsx`
- Test: `/components/__tests__/client-portal-mobile-annotations.test.tsx`
- Test: add a dedicated portal readonly test if the current test file is too unrelated

- [ ] **Step 1: Write the failing portal read-only test**

Cover:
- when URL search params contain `readonly=true`, the portal hides write actions
- video and read-only content still render

Minimum expectations:
- approve CTA absent
- main feedback submission CTA absent
- thread reply composer absent

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/__tests__/client-portal-mobile-annotations.test.tsx`

Expected: FAIL because portal still renders write actions

- [ ] **Step 3: Implement minimal portal state**

In `/app/client-portal/[token]/page.tsx`:
- read `readonly` from `useSearchParams()`
- derive `const isDemoReadonly = searchParams.get("readonly") === "true";`
- keep the flag local unless a tiny helper prop/state abstraction makes the JSX cleaner

- [ ] **Step 4: Hide write UI when `isDemoReadonly` is true**

Conditionally hide:
- approve button/dialog trigger
- feedback submission form or submit CTA
- thread reply composer and submit button
- any create/edit CTA in the public portal screen

Optional:
- show a small passive read-only note near the portal actions

- [ ] **Step 5: Prevent client-side write attempts in portal logic**

Guard functions such as:
- `approveVersion`
- feedback submit handler
- `handleThreadReply`
- `markThreadRead`

So they return early in read-only mode even if invoked unexpectedly from stale UI state.

- [ ] **Step 6: Run the focused portal test**

Run: `npm run test -- components/__tests__/client-portal-mobile-annotations.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/client-portal/[token]/page.tsx components/__tests__/client-portal-mobile-annotations.test.tsx
git commit -m "feat: add read-only demo mode to client portal"
```

## Chunk 4: Server-Side Write Guards for Public Routes

### Task 5: Block demo approve requests

**Files:**
- Modify: `/app/api/public/portal/[token]/approve/route.ts`
- Test: `/tests/api/public-portal.test.ts`

- [ ] **Step 1: Extend the failing API test**

Add a case:
- configure `process.env.DEMO_PORTAL_TOKEN`
- POST approve using that token
- expect `403`
- expect an error payload containing `DEMO_READONLY`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: FAIL because route still allows the write path

- [ ] **Step 3: Add the guard**

At the top of the handler:

```ts
if (isDemoToken(token)) {
  return Response.json(
    { code: "DEMO_READONLY", error: "Demo mode is read-only" },
    { status: 403 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/public/portal/[token]/approve/route.ts tests/api/public-portal.test.ts
git commit -m "feat: block demo approve writes"
```

### Task 6: Block demo feedback creation

**Files:**
- Modify: `/app/api/public/feedback/route.ts`
- Test: `/tests/api/public-portal.test.ts` or a dedicated public feedback API test if coverage belongs elsewhere

- [ ] **Step 1: Extend the failing API test**

Add a case for POST `/api/public/feedback` with the demo portal token and expect `403`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: FAIL

- [ ] **Step 3: Add the guard**

Reject before any validation that would write feedback:

```ts
if (isDemoToken(body.token)) {
  return Response.json(
    { code: "DEMO_READONLY", error: "Demo mode is read-only" },
    { status: 403 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/public/feedback/route.ts tests/api/public-portal.test.ts
git commit -m "feat: block demo feedback writes"
```

### Task 7: Block demo thread replies and read markers

**Files:**
- Modify: `/app/api/public/feedback/[id]/thread/route.ts`
- Modify: `/app/api/public/feedback/[id]/thread/read/route.ts`
- Test: `/tests/api/public-portal.test.ts` or a dedicated API test file covering public thread endpoints

- [ ] **Step 1: Extend the failing API tests**

Add cases:
- POST thread reply with demo token returns `403`
- POST thread read-mark with demo token returns `403`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: FAIL

- [ ] **Step 3: Add guards to both routes**

Use `isDemoToken(token)` before any service call or DB write in both handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/public/feedback/[id]/thread/route.ts app/api/public/feedback/[id]/thread/read/route.ts tests/api/public-portal.test.ts
git commit -m "feat: block demo thread writes"
```

## Chunk 5: Regression Verification

### Task 8: Verify normal public GET behavior is unchanged

**Files:**
- Test: `/tests/api/public-portal.test.ts`

- [ ] **Step 1: Run the existing public portal GET coverage**

Run: `npm run test:api -- tests/api/public-portal.test.ts`

Expected: PASS for:
- normal public portal fetch
- version switching
- non-demo token behavior

- [ ] **Step 2: Run the targeted portal component coverage**

Run: `npm run test -- components/__tests__/client-portal-mobile-annotations.test.tsx`

Expected: PASS

- [ ] **Step 3: Run static verification for modified files**

Run: `npm run lint`
Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 4: Manual sanity-check**

Verify locally:
- `/demo/[demo-token]` redirects correctly
- portal opens without login
- player and version switching still work
- no write CTAs appear
- direct POSTs to demo write endpoints are rejected

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify demo read-only flow"
```
