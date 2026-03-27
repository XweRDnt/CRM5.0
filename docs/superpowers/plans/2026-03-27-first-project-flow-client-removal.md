# First Project Flow Client Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `Client` entity from the product, simplify signup and project creation, and redesign the first-project upload flow around polished blur dialogs.

**Architecture:** The refactor removes `ClientAccount` from Prisma and all project dependencies, then rebuilds the UI around a modal-first onboarding flow. Version sequencing remains internal, while the UI exposes an editable version title with a generated default label.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, PostgreSQL, SWR, react-hook-form, zod, Vitest

---

## File Structure

### Core schema and backend files

- Modify: `prisma/schema.prisma`
- Modify: `app/api/auth/signup/route.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `app/api/projects/[id]/versions/route.ts`
- Modify: `app/api/projects/[id]/versions/meta/route.ts`
- Modify: `app/api/public/portal/[token]/route.ts`
- Modify: `lib/services/auth.service.ts`
- Modify: `lib/services/project.service.ts`
- Modify: `lib/services/asset.service.ts`
- Modify: `types/index.ts` or equivalent shared type file
- Delete: `app/api/clients/route.ts`
- Delete: `app/api/clients/[id]/route.ts`
- Delete: `lib/services/client.service.ts`

### UI files

- Modify: `app/(auth)/signup/page.tsx`
- Modify: `app/(dashboard)/projects/page.tsx`
- Replace or repurpose: `app/(dashboard)/projects/new/page.tsx`
- Modify: `app/(dashboard)/projects/[id]/page.tsx`
- Modify: `components/projects/ProjectCard.tsx`
- Modify: `components/versions/VersionUploadDialog.tsx`
- Modify: `components/versions/VersionUploadFlow.tsx`
- Create: `components/projects/CreateProjectDialog.tsx`
- Delete: `components/clients/client-form.tsx`
- Delete: `components/clients/client-list.tsx`
- Delete: `app/(dashboard)/clients/...`

### Tests and factories

- Modify: `tests/api/helpers.ts`
- Delete: `tests/api/clients.test.ts`
- Modify: `tests/api/projects.test.ts`
- Modify: `tests/api/public-portal.test.ts`
- Modify: `tests/api/tasks.test.ts`
- Modify: `tests/api/versions.test.ts`
- Delete or replace: `tests/factories/client.factory.ts`
- Modify: `tests/factories/project.factory.ts`
- Modify: project/asset/auth service tests that currently require clients

## Chunk 1: Schema And Shared Contract Cleanup

### Task 1: Write failing schema-contract tests for project creation without clients

**Files:**
- Modify: `tests/api/projects.test.ts`
- Modify: `tests/api/helpers.ts`

- [ ] **Step 1: Write the failing test**

Add tests that create a project with only `name`, and update helpers so the desired API no longer takes `clientId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/projects.test.ts`
Expected: FAIL because API still requires `clientId` and old helper contracts.

- [ ] **Step 3: Write minimal implementation**

Update test helpers and route payload expectations in the narrowest way needed to express the new contract.

- [ ] **Step 4: Run test to verify it passes or fails for the next backend reason**

Run: `npm test -- tests/api/projects.test.ts`
Expected: failure moves deeper into service/schema logic, proving the contract changed.

- [ ] **Step 5: Commit**

```bash
git add tests/api/projects.test.ts tests/api/helpers.ts
git commit -m "test: define project api without clients"
```

### Task 2: Remove `ClientAccount` and client linkage from Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the failing test**

Use the failing API/service tests from Task 1 as the red state. Do not add production code first.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/projects.test.ts`
Expected: FAIL because Prisma-backed project creation still expects `clientAccountId`.

- [ ] **Step 3: Write minimal implementation**

Remove:
- `Tenant.clients`
- `ClientAccount` model
- `Project.clientAccountId`
- `Project.client`

Keep:
- `Project.name`
- version sequencing fields for now

- [ ] **Step 4: Run type generation / schema verification**

Run: `npx prisma generate`
Expected: Prisma client regenerates successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "refactor: remove client model from prisma schema"
```

## Chunk 2: Backend Refactor

### Task 3: Simplify signup payload and user creation

**Files:**
- Modify: `app/api/auth/signup/route.ts`
- Modify: `lib/services/auth.service.ts`
- Test: signup-related tests under `tests` and `lib/services/__tests__`

- [ ] **Step 1: Write the failing test**

Add or update tests so signup succeeds with:
- `workspaceName`
- `email`
- `password`

and no longer requires `firstName` / `lastName`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api projects.test.ts`
Expected: FAIL because signup schema still requires removed fields.

- [ ] **Step 3: Write minimal implementation**

Update route validation and auth service defaults so user records are still valid after first/last name removal from signup input.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/api/projects.test.ts tests/api/versions.test.ts`
Expected: signup-related expectations pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/signup/route.ts lib/services/auth.service.ts tests
git commit -m "refactor: simplify signup payload"
```

### Task 4: Remove client-aware project APIs and services

**Files:**
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[id]/route.ts`
- Modify: `lib/services/project.service.ts`
- Modify: shared `types` definitions
- Delete: `app/api/clients/route.ts`
- Delete: `app/api/clients/[id]/route.ts`
- Delete: `lib/services/client.service.ts`

- [ ] **Step 1: Write the failing test**

Update service/API tests so:
- create project accepts only `name`
- update project no longer accepts `clientId`
- list filters no longer include `clientId`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/projects.test.ts lib/services/__tests__/project.service.test.ts`
Expected: FAIL because old client-aware service logic is still active.

- [ ] **Step 3: Write minimal implementation**

Remove client-related schema parsing, DB joins, filter logic, and response mapping.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/api/projects.test.ts lib/services/__tests__/project.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects app/api/clients lib/services/project.service.ts lib/services/client.service.ts types tests
git commit -m "refactor: remove client-aware project backend"
```

### Task 5: Replace manual version numbers with generated titles

**Files:**
- Modify: `app/api/projects/[id]/versions/route.ts`
- Modify: `app/api/projects/[id]/versions/meta/route.ts`
- Modify: `lib/services/asset.service.ts`
- Modify: shared `types` definitions

- [ ] **Step 1: Write the failing test**

Add tests that:
- create a version without passing `versionNo`
- generate the next internal sequence automatically
- accept optional editable title
- fall back to `Версия N` when no custom title is provided

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/versions.test.ts lib/services/__tests__/asset.service.test.ts`
Expected: FAIL because the API still expects `versionNo`.

- [ ] **Step 3: Write minimal implementation**

Add internal next-version computation on the server and store or expose a display title field for the UI.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/api/versions.test.ts lib/services/__tests__/asset.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/[id]/versions app/api/projects/[id]/versions/meta lib/services/asset.service.ts types tests
git commit -m "feat: auto-name uploaded versions"
```

## Chunk 3: UI Redesign

### Task 6: Redesign signup in dashboard visual language

**Files:**
- Modify: `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Write the failing test**

Update or add UI tests to assert:
- only workspace, email, password fields render
- removed first/last name labels are absent
- successful submit targets the first-project flow entrypoint

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/(auth)/signup/page.tsx`
Expected: FAIL because old fields still render.

- [ ] **Step 3: Write minimal implementation**

Refactor the signup page to match the internal glass/blur product style and wire submit redirect toward the first-project flow.

- [ ] **Step 4: Run focused tests**

Run: `npm test --`
Expected: signup UI tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/signup/page.tsx tests components
git commit -m "feat: redesign signup for first project flow"
```

### Task 7: Replace project creation page with blur modal flow

**Files:**
- Create: `components/projects/CreateProjectDialog.tsx`
- Modify: `app/(dashboard)/projects/page.tsx`
- Replace or slim: `app/(dashboard)/projects/new/page.tsx`
- Modify: `components/projects/ProjectCard.tsx`
- Modify: `app/(dashboard)/projects/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Add UI tests that assert:
- create-project entry opens a dialog
- dialog contains only project name input
- empty-state CTA and header CTA reuse the same modal

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/projects`
Expected: FAIL because creation still lives on a full page with extra fields.

- [ ] **Step 3: Write minimal implementation**

Build the shared blur dialog, remove obsolete form fields, and route new-project creation through the modal.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- components/projects app/(dashboard)/projects/page.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/projects app/(dashboard)/projects app/(dashboard)/projects/[id]/page.tsx tests
git commit -m "feat: move project creation into blur dialog"
```

### Task 8: Redesign upload modal and drag/drop surface

**Files:**
- Modify: `components/versions/VersionUploadDialog.tsx`
- Modify: `components/versions/VersionUploadFlow.tsx`

- [ ] **Step 1: Write the failing test**

Add or update tests that assert:
- no manual version number input is rendered
- editable version title input is rendered
- default title shows `Версия N`
- drag-and-drop surface occupies the main dialog area

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/versions`
Expected: FAIL because the old flow still renders version number and smaller upload layout.

- [ ] **Step 3: Write minimal implementation**

Rework the upload modal into the shared blur style, enlarge the dropzone, and swap version-number editing for editable auto-generated version titles.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- components/versions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/versions tests
git commit -m "feat: redesign version upload dialog"
```

## Chunk 4: Cleanup And Regression

### Task 9: Remove client pages, nav traces, dashboard counts, and stale factories

**Files:**
- Delete: `app/(dashboard)/clients/**`
- Delete: `components/clients/**`
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/layout/Sidebar.tsx`
- Modify: `lib/i18n/messages.ts`
- Modify: `tests/factories/project.factory.ts`
- Delete or replace: `tests/factories/client.factory.ts`

- [ ] **Step 1: Write the failing test**

Add or update tests so UI/navigation no longer references client management and project factories no longer require client creation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --`
Expected: FAIL on remaining client references.

- [ ] **Step 3: Write minimal implementation**

Remove leftover client UI and update fixtures/factories to the simplified project model.

- [ ] **Step 4: Run focused tests**

Run: `npm test --`
Expected: client UI and factory tests pass cleanly.

- [ ] **Step 5: Commit**

```bash
git add app components lib tests
git commit -m "refactor: remove remaining client surfaces"
```

### Task 10: Verify end-to-end regression surface

**Files:**
- Modify as needed based on failing tests

- [ ] **Step 1: Run backend and UI verification**

Run: `npm test -- tests/api/projects.test.ts tests/api/versions.test.ts`
Expected: PASS.

- [ ] **Step 2: Run broader targeted suite**

Run: `npm test -- lib/services/__tests__/project.service.test.ts lib/services/__tests__/asset.service.test.ts components/versions/__tests__/VersionUploadFlow.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run lint / type verification**

Run: `npm run lint`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Review changed files and remove dead code**

Run: `git diff --stat`
Expected: removed client surface, simplified project flow, no accidental unrelated edits.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: streamline first project creation flow"
```
