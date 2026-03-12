# Project Delete Kinescope Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** When deleting a project, delete all related Kinescope videos (best-effort) before removing the project from the database.

**Architecture:** Extend ProjectService.deleteProject to query Kinescope-backed AssetVersion rows for the project, call getKinescopeService().deleteVideo per video with error logging, then delete the project. Update the API route to use the service method.

**Tech Stack:** Next.js App Router, Prisma, Vitest, Kinescope API

---

## Chunk 1: Tests + Service Behavior

### Task 1: Add failing tests for project delete Kinescope cleanup

**Files:**
- Modify: lib/services/__tests__/project.service.test.ts

- [ ] **Step 1: Write the failing tests**

`	s
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoProvider } from "@prisma/client";
import { ProjectService } from "@/lib/services/project.service";
import { prisma } from "@/lib/utils/db";

const deleteVideoMock = vi.fn();

vi.mock("@/lib/services/kinescope.service", () => ({
  getKinescopeService: () => ({
    deleteVideo: deleteVideoMock,
  }),
}));

// tests: deletes kinescope videos, skips non-kinescope, logs and continues on error
`

Add tests similar to:
- it("deletes kinescope videos before removing project")
- it("skips non-kinescope versions")
- it("logs errors and still deletes project")

Use console.error spy to assert logging when deleteVideo throws.

- [ ] **Step 2: Run test to verify it fails**

Run:
`ash
echo "Run vitest: project.service.test.ts"
`
Expected: FAIL because deleteProject is not implemented.

### Task 2: Implement ProjectService.deleteProject with Kinescope cleanup

**Files:**
- Modify: lib/services/project.service.ts

- [ ] **Step 1: Implement minimal code to satisfy tests**

Add logic:
- validate 	enantId and projectId
- query asset versions with ideoProvider = KINESCOPE and kinescopeVideoId != null scoped to tenant
- for each version call getKinescopeService().deleteVideo(kinescopeVideoId)
- on error: console.error with context and continue
- delete project (use deleteMany with id + tenant condition)
- if deleted count == 0, throw Project not found

- [ ] **Step 2: Run tests and confirm pass**

Run:
`ash
echo "Run vitest: project.service.test.ts"
`
Expected: PASS

- [ ] **Step 3: Commit**

`ash
git add lib/services/project.service.ts lib/services/__tests__/project.service.test.ts

git commit -m "Cleanup Kinescope videos on project delete"
`

## Chunk 2: Wire API Route

### Task 3: Use ProjectService.deleteProject in API

**Files:**
- Modify: pp/api/projects/[id]/route.ts

- [ ] **Step 1: Update route to call projectService.deleteProject**

Use existing auth/role checks, then call:
`	s
await projectService.deleteProject({ tenantId: req.user.tenantId, userId: req.user.userId, role: req.user.role }, { projectId: id, user: req.user });
`
(If user is not required by your final signature, omit it.)

- [ ] **Step 2: Run focused test**

Run:
`ash
echo "Run vitest: project.service.test.ts"
`
Expected: PASS

- [ ] **Step 3: Commit**

`ash
git add app/api/projects/[id]/route.ts

git commit -m "Route delete project uses ProjectService"
`

## Chunk 3: Update Memory Bank

### Task 4: Update memory-bank

**Files:**
- Modify: memory-bank/memory-bank/activeContext.md
- Modify: memory-bank/memory-bank/progress.md
- Modify: memory-bank/memory-bank/errorJournal.md

- [ ] **Step 1: Mark project deletion as done in activeContext**
- [ ] **Step 2: Move item to Реализовано in progress**
- [ ] **Step 3: Add any notable errors to errorJournal (if any)**

- [ ] **Step 4: Commit**

`ash
git add memory-bank/memory-bank/activeContext.md memory-bank/memory-bank/progress.md memory-bank/memory-bank/errorJournal.md

git commit -m "Update memory bank for project deletion cleanup"
`

---

## Notes
- Keep tenant scoping in all Prisma queries.
- Best-effort Kinescope deletes: log errors and continue.
- Use the same Kinescope delete API as AssetService.deleteVersion.