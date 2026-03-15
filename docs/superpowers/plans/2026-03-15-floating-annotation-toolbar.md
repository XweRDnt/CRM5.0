# Floating Annotation Toolbar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first floating annotation toolbar for client-portal video annotations and allow submitting drawing-only feedback without a required comment.

**Architecture:** Keep changes localized to `app/client-portal/[token]/page.tsx`. Replace the current top-left toolbar with a bottom-center floating toolbar that groups tools, options, undo/redo, and send. Adjust validation so comment text is optional when strokes exist while preserving current payload structure.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, existing annotation utilities.

---

## Chunk 1: Discovery + UI Refactor Plan

### Task 1: Map affected files and current validation

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`
- Inspect: `app/api/public/feedback/route.ts` (or equivalent) for validation
- Inspect: `lib/annotations/*` for helper usage

- [ ] **Step 1: Locate server-side validation for comment text**

Run: `rg -n "feedback" app -g "*.ts"`
Expected: find POST handler for `/api/public/feedback` to verify whether `text` is required.

- [ ] **Step 2: Locate current toolbar JSX and note removal points**

Run: `rg -n "annotationMode" app/client-portal/[token]/page.tsx`
Expected: identify the existing top-left toolbar and cancel button section.

- [ ] **Step 3: Sketch new toolbar structure in JSX**

Prepare a new `div` with bottom-center positioning and grouped controls.

- [ ] **Step 4: Commit discovery notes**

```bash
git status --short
```
Expected: no changes yet.

---

## Chunk 2: UI Implementation (Toolbar)

### Task 2: Replace top-left toolbar with floating bottom-center toolbar

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Add new toolbar JSX (bottom-center)**

Include tool buttons, undo/redo, and send; move color/thickness to a compact row.

- [ ] **Step 2: Remove old top-left toolbar block**

Delete the `top-3 left-3` toolbar and adjust cancel button placement.

- [ ] **Step 3: Ensure z-index and pointer-events are correct**

Toolbar `z-40`, overlay remains interactive for drawing.

- [ ] **Step 4: Run manual UI sanity check**

Run: `pnpm dev`
Expected: toolbar appears when annotation mode on, not blocking drawing.

- [ ] **Step 5: Commit UI changes**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "feat: add floating annotation toolbar"
```

---

## Chunk 3: Validation & Submit Changes

### Task 3: Allow drawing-only submissions

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`
- Modify: `app/api/public/feedback/route.ts` (if server validation requires text)

- [ ] **Step 1: Update form controls**

Remove `required` from comment textarea. Update disabled condition on submit to allow empty text when strokes exist.

- [ ] **Step 2: Update submit logic**

Allow payload where `text` may be empty if `annotationStrokes.length > 0`.

- [ ] **Step 3: Update server-side validation (if needed)**

Ensure backend accepts missing or empty `text` when annotation data is present.

- [ ] **Step 4: Manual test matrix**

1. name + drawing only
1. name + text only
1. name + text + drawing

Expected: all submit successfully.

- [ ] **Step 5: Commit validation changes**

```bash
git add app/client-portal/[token]/page.tsx app/api/public/feedback/route.ts
git commit -m "feat: allow annotation-only feedback"
```

---

## Chunk 4: Polish + Docs

### Task 4: Polish animations and memory bank

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`
- Modify: `memory-bank/memory-bank/activeContext.md`
- Modify: `memory-bank/memory-bank/errorJournal.md` (if any issues occurred)

- [ ] **Step 1: Add subtle animation classes**

Use Tailwind transitions for opacity/translate.

- [ ] **Step 2: Update memory bank**

Document the floating toolbar and optional comment submission.

- [ ] **Step 3: Final manual verification**

Check mobile viewport, ensure no overlap with system areas.

- [ ] **Step 4: Commit final polish**

```bash
git add app/client-portal/[token]/page.tsx memory-bank/memory-bank/activeContext.md memory-bank/memory-bank/errorJournal.md
git commit -m "chore: polish annotation toolbar"
```
