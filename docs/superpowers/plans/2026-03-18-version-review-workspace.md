# Version Review Workspace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the internal version page into a premium PM review workspace with a hidden shared header, a larger stage-focused player area, and a more intentional feedback panel.

**Architecture:** Keep existing data and interaction logic in place while restructuring presentation at two levels: route shell (`DashboardLayout`) and the version review page. The shared header is conditionally suppressed for this route only, while the page itself gets a redesigned workspace layout with improved stage and review-panel composition.

**Tech Stack:** Next.js App Router, React client components, SWR, Tailwind utilities, local `style jsx global`, Lucide icons, existing Kinescope player and annotation helpers.

---

## File Structure

- Modify: `app/(dashboard)/layout.tsx`
  Responsibility: hide the shared dashboard header for the version review route only.
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`
  Responsibility: rebuild the route-level PM workspace layout and visual hierarchy without changing data flow.
- Verify: `components/layout/Header.tsx`
  Responsibility: confirm no additional changes are needed after the route-level hide logic.

## Chunk 1: Route Shell

### Task 1: Hide shared header on version review route only

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Verify: `components/layout/Header.tsx`

- [ ] **Step 1: Inspect current layout render path**

Read the route shell and confirm where `Header` is mounted relative to `children`.

- [ ] **Step 2: Add route-aware header suppression**

Use pathname-based logic in the dashboard layout so `Header` is not rendered for `/projects/[id]/versions/[versionId]` and nested review states if needed, without affecting other dashboard routes.

- [ ] **Step 3: Verify mobile sidebar behavior is unchanged**

Check that removing `Header` on this route does not break the mobile sidebar open flow or create inaccessible navigation on desktop.

- [ ] **Step 4: Run targeted lint**

Run: `node ./node_modules/eslint/bin/eslint.js "app/(dashboard)/layout.tsx"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/layout.tsx
git commit -m "refactor: hide dashboard header on version review page"
```

## Chunk 2: Workspace Layout

### Task 2: Rebuild top section into page-owned workspace chrome

**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`

- [ ] **Step 1: Write the failing visual expectation**

Document the target structure inline in the plan for implementation:
- page-owned top section
- title/status row
- tabs/actions row
- no dependency on shared header spacing assumptions

- [ ] **Step 2: Recompose top section markup**

Update the page so the top area is part of the workspace itself and reads as premium PM chrome instead of a generic card header.

- [ ] **Step 3: Rebalance spacing and hierarchy**

Ensure title, status, tabs, and actions have a clearer visual hierarchy and survive medium-width layouts.

- [ ] **Step 4: Run targeted lint**

Run: `node ./node_modules/eslint/bin/eslint.js "app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx"`
Expected: no errors.

### Task 3: Fix player stage proportions and stage presentation

**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`

- [ ] **Step 1: Replace compressed player framing**

Adjust the stage container so the player has a stable large aspect ratio and no flattened appearance.

- [ ] **Step 2: Improve stage styling**

Apply more intentional depth, border, shadow, and supporting metadata composition around the player without changing player behavior.

- [ ] **Step 3: Preserve overlay behavior**

Confirm annotation overlay, hide button, and processing messages still sit correctly in the new stage.

- [ ] **Step 4: Run targeted lint**

Run: `node ./node_modules/eslint/bin/eslint.js "app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx"`
Expected: no errors.

## Chunk 3: Review Panel

### Task 4: Redesign comments panel into a review workspace column

**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`

- [ ] **Step 1: Rebuild panel chrome**

Give the right column a stronger sticky header, better panel framing, and cleaner spacing for filters and count summary.

- [ ] **Step 2: Redesign comment cards**

Improve hierarchy for author, timecode, text, status, annotation marker, and expansion affordance. New/unread items should have a subtle accent signal.

- [ ] **Step 3: Redesign expanded thread area**

Keep existing placeholder reply logic but present it as a usable thread surface instead of a collapsed utility form.

- [ ] **Step 4: Preserve behavior**

Verify:
- filter buttons still switch visible items
- clicking card still toggles expansion
- clicking timecode still seeks player
- reply input remains permission-gated

- [ ] **Step 5: Run targeted lint**

Run: `node ./node_modules/eslint/bin/eslint.js "app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx"`
Expected: no errors.

## Chunk 4: Verification

### Task 5: Final verification and cleanup

**Files:**
- Modify: `app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Run targeted lint on both modified files**

Run: `node ./node_modules/eslint/bin/eslint.js "app/(dashboard)/layout.tsx" "app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx"`
Expected: no errors.

- [ ] **Step 2: Run typecheck**

Run: `npm.cmd run typecheck`
Expected: either pass, or reproduce the already-known `FeedbackStatus` mismatch outside the redesign scope. If it fails, capture the exact blocker in the final report.

- [ ] **Step 3: Manual visual verification**

Check:
- shared header removed on this route
- player no longer feels flattened
- comments panel reads faster and looks more premium
- mobile/tablet layout still stacks correctly

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/layout.tsx app/(dashboard)/projects/[id]/versions/[versionId]/page.tsx
git commit -m "feat: redesign version review workspace"
```
