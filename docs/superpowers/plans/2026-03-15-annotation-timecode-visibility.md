# Timecode-Bound Annotation Visibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide annotations on playback and show them only when paused at the annotation timecode.

**Architecture:** Add a small visibility controller in `app/client-portal/[token]/page.tsx` that tracks play state and the selected annotation’s timecode, then derives whether the active annotation should be visible.

**Tech Stack:** Next.js App Router, React state/effects.

---

## Chunk 1: State + Effect

### Task 1: Track selected annotation and play state

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Add state for `isPlayerPlaying`**

Use `onPlay`/`onPause` from `KinescopePlayer` to update it.

- [ ] **Step 2: Add state for `selectedAnnotation`**

Store `{ timecodeSec, data }` when a feedback item is clicked.

- [ ] **Step 3: Add effect to sync visibility**

If playing > clear `activeAnnotation`. If paused and timecode matches > show; else hide.

- [ ] **Step 4: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "feat: hide annotations on play and bind to timecode"
```

---

## Chunk 2: Docs

### Task 2: Update memory bank

**Files:**
- Modify: `memory-bank/memory-bank/activeContext.md`

- [ ] **Step 1: Update active context**

Note the new timecode-bound annotation behavior.

- [ ] **Step 2: Commit**

```bash
git add memory-bank/memory-bank/activeContext.md
git commit -m "chore: document timecode-bound annotation visibility"
```
