# Client Portal Redesign (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix visual hierarchy issues and two bugs (author name encoding + annotation toggle) in the client portal UI while keeping existing logic intact.

**Architecture:** Single-file updates in `app/client-portal/[token]/page.tsx` plus targeted investigation for author name encoding. Keep annotation logic untouched; only fix the trigger wiring if broken.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui, Prisma.

---

## File Map
- Modify: `app/client-portal/[token]/page.tsx`
- Investigate (if needed): API route for portal `app/api/public/portal/[token]/route.ts` and related DB data handling

## Chunk 1: UI Hierarchy & Layout Adjustments

### Task 1: Base layout + column contrast

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Background + left column tone**

Set page base background to `#080808` and ensure left column inherits it:
```tsx
<main className="min-h-screen bg-[#080808] text-white">
```

- [ ] **Step 2: Right panel surface tone**

Apply subtle surface on `<aside>` only:
```tsx
<aside className="flex w-full flex-col overflow-hidden bg-white/[0.03] lg:h-[calc(100vh-4.5rem)] lg:w-[30%]">
```

Keep internal list transparent (no container bg).

- [ ] **Step 3: Header glass adjustment**

Update header:
```tsx
<header className="sticky top-0 z-30 h-12 border-b border-white/5 bg-black/50 backdrop-blur-xl">
```

Ensure approve button stays `bg-emerald-500 rounded-full`.

- [ ] **Step 4: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: strengthen portal hierarchy and glass header"
```

### Task 2: Comments list minimalism

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Remove card borders and separators**

Each comment item:
```tsx
<article className="px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors">
```
(no borders, no separators, no bg)

- [ ] **Step 2: Typography tweaks**

Header:
```tsx
<div className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-white/30">Комментарии</div>
```

Time pill:
```tsx
className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-400"
```

Text:
```tsx
className="mt-1 text-sm leading-relaxed text-white/55"
```

- [ ] **Step 3: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: simplify portal comments list"
```

### Task 3: Input row as single pill

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Make input row a monolithic pill**

Ensure both name + text are in one container and separated by a hairline divider:
```tsx
<div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-2.5">
  <Input className="w-20 flex-shrink-0 bg-transparent text-sm text-white/40 placeholder:text-white/25 focus-visible:ring-0" ... />
  <span className="h-4 w-px bg-white/10" />
  <Input className="flex-1 bg-transparent text-sm text-white/70 placeholder:text-white/25 focus-visible:ring-0" ... />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: make portal input row feel native"
```

## Chunk 2: Bug Fixes

### Task 4: Fix author name encoding ("?????")

**Files:**
- Investigate: `app/api/public/portal/[token]/route.ts`
- Modify: `app/client-portal/[token]/page.tsx` or API route if needed

- [ ] **Step 1: Reproduce and inspect API response**

Use dev server + curl to check if API returns garbled names. If API data is correct, issue is in rendering. If API data is garbled, fix at source.

- [ ] **Step 2: Fix root cause**

If data is garbled due to encoding of stored names, normalize to UTF-8 at seed/insert time. If issue is from `authorName` fallback, ensure proper string handling.

- [ ] **Step 3: Verify names render correctly**

Confirm Russian names show properly in portal UI.

- [ ] **Step 4: Commit**

```bash
git add app/client-portal/[token]/page.tsx app/api/public/portal/[token]/route.ts
 git commit -m "fix: correct client portal author name encoding"
```

### Task 5: Fix pencil toggle not activating annotations

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Verify toggle wiring**

Ensure pencil button uses `toggleAnnotationMode` and not blocked by overlay or disabled state.

- [ ] **Step 2: Fix if broken**

Restore proper handler, ensure `disabled` only when version locked or player not ready.

- [ ] **Step 3: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "fix: re-enable portal annotation toggle"
```

## Chunk 3: Manual Verification

### Task 6: Visual & behavior check

- [ ] **Step 1: Run dev server**

```bash
npm.cmd run dev
```

- [ ] **Step 2: Verify**

Checklist:
- Header glass + approve pill looks right
- Left area deep black, right panel slightly lighter
- Comments appear as text, no borders
- Input row feels native/pill
- Pencil toggle works
- Names display correctly

- [ ] **Step 3: Final commit (if needed)**

```bash
git add app/client-portal/[token]/page.tsx
 git commit -m "ui: finalize client portal redesign polish"
```
