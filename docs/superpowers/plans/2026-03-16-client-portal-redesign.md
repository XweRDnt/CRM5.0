# Client Portal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the client portal page to the Apple-like UI spec, keeping all existing behavior and logic intact.

**Architecture:** Single-file UI refactor within `app/client-portal/[token]/page.tsx`, reorganizing JSX layout and Tailwind classes while preserving handlers/state. Annotation overlay logic stays unchanged; only its trigger/toolbar placement and styles change.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui, SWR.

---

## File Map
- Modify: `app/client-portal/[token]/page.tsx`
- No new files planned.

## Chunk 1: Base Layout + Header + Player Container

### Task 1: Update page background and header styles

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Update main background wrapper**

Replace the `<main>` class with:
```tsx
<main className="min-h-screen bg-[#0a0a0a] text-white">
```

Add subtle radial gradient around the player by wrapping the left column container with:
```tsx
<section className="relative flex w-full flex-col gap-4 lg:w-[70%]">
  <div className="pointer-events-none absolute -inset-x-6 -inset-y-8 rounded-[28px] bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.03),transparent_55%)]" />
  <div className="relative flex flex-col gap-4">
    ...existing left column content...
  </div>
</section>
```

- [ ] **Step 2: Restyle header container + text**

Update header classes:
```tsx
<header className="sticky top-0 z-30 h-12 border-b border-white/5 bg-black/60 backdrop-blur-xl">
```

Update title + version classes:
```tsx
<span className="text-sm font-medium text-white">{data.project.name}</span>
<span className="text-xs text-white/40">Версия {activeVersion?.versionNumber ?? "—"}</span>
```

Update button styles:
```tsx
className={cn(
  "h-8 rounded-full px-5 text-xs font-semibold",
  isVersionLocked
    ? "bg-white/8 text-white/30"
    : "bg-emerald-500 text-white hover:bg-emerald-400",
)}
```

- [ ] **Step 3: Manual sanity check**

Open the portal page and confirm the header blur, thinner border, and softer typography.

### Task 2: Player container polish

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Remove border and add gradient overlay**

Update player wrapper:
```tsx
<div className="relative overflow-hidden rounded-2xl bg-black">
```

Add a controls gradient layer inside the player container (just above the player, below the overlay tools):
```tsx
<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-black/80 to-transparent" />
```

Ensure overlay remains above this gradient.

- [ ] **Step 2: Manual check**

Verify the player has no border and a subtle bottom fade.

- [ ] **Step 3: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: soften portal base layout and header"
```

## Chunk 2: Input Row + Annotation Toolbar Relocation

### Task 3: Replace textarea with single-line input row

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Remove textarea and build single-line row**

Replace the existing time row + textarea form with a single line (keep `commentText` state and `submitFeedback`).

Example structure:
```tsx
<form onSubmit={submitFeedback} className="mt-2">
  <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-2.5">
    <button
      type="button"
      onClick={() => setCapturedTimecodeSec(null)}
      className="rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-mono text-blue-400"
    >
      {formatTimecode(playerCurrentTimeSec)}
    </button>

    <Input
      value={commentText}
      onChange={(event) => setCommentText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && canSubmit) {
          event.preventDefault();
          void submitFeedback(event);
        }
      }}
      placeholder={`Правка к ${formatTimecode(playerCurrentTimeSec)}...`}
      className="h-8 flex-1 border-none bg-transparent text-sm text-white/70 placeholder:text-white/25 focus-visible:ring-0"
      disabled={isVersionLocked}
    />

    <button
      type="button"
      onClick={toggleAnnotationMode}
      disabled={isVersionLocked || !playerReady}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 bg-white/5",
        annotationMode && "border-blue-500/40 bg-blue-500/20 text-blue-400",
      )}
      aria-label={annotationMode ? "Закрыть рисование" : "Рисовать"}
    >
      <Pencil className="h-4 w-4" />
    </button>

    <button
      type="submit"
      disabled={!canSubmit}
      className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500 text-white"
      aria-label="Отправить"
    >
      <Send className="h-4 w-4" />
    </button>
  </div>
</form>
```

- [ ] **Step 2: Manual check**

Ensure Enter submits (when `canSubmit`) and Shift+Enter does nothing special.

### Task 4: Move annotation toolbar below player

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Remove floating toolbar from overlay block**

Delete the floating widget inside the overlay (keep the overlay SVG and active annotation logic intact).

- [ ] **Step 2: Add toolbar block between player and input row**

Insert a toolbar container below the player and above the input row:
```tsx
{annotationMode ? (
  <div className="animate-[fadeDown_180ms_ease-out] rounded-2xl border border-white/6 bg-white/4 px-4 py-2.5">
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {/* tool buttons */}
      </div>
      <div className="h-5 w-px bg-white/10" />
      <div className="flex items-center gap-1">
        {/* color dots */}
      </div>
      <div className="h-5 w-px bg-white/10" />
      <div className="flex items-center gap-1">
        {/* thickness buttons */}
      </div>
      <div className="h-5 w-px bg-white/10" />
      <button ...>Undo</button>
      <button ...>Redo</button>
    </div>
  </div>
) : null}
```

Use tool button classes:
- active: `bg-white text-black`
- default: `bg-transparent text-white/50 hover:text-white`

Color dots:
- base: `w-5 h-5 rounded-full`
- active: `ring-2 ring-white/60 ring-offset-1 ring-offset-transparent`

- [ ] **Step 3: Manual check**

Toggle annotation mode and confirm the toolbar appears below the player with correct styling.

- [ ] **Step 4: Commit**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: replace portal input row and relocate annotation toolbar"
```

## Chunk 3: Comments Panel + Dialog Polish

### Task 5: Restyle comments panel

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`

- [ ] **Step 1: Update aside container and header**

Use:
```tsx
<aside className="flex w-full flex-col overflow-hidden lg:h-[calc(100vh-4.5rem)] lg:w-[30%]">
```

Header:
```tsx
<div className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-white/30">Комментарии</div>
```

- [ ] **Step 2: Update card styles**

Card wrapper:
```tsx
<article className="rounded-xl px-3 py-2.5 transition-colors hover:bg-white/4">
```

Author/time row:
```tsx
<span className="text-xs font-medium text-white/80">{item.authorName}</span>
<button className="rounded-md bg-blue-500/10 px-2 text-[11px] text-blue-400">...</button>
```

Add annotation dot (when annotationData exists):
```tsx
{item.annotationData ? <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
```

Text:
```tsx
<p className="mt-1 text-sm leading-relaxed text-white/55">...</p>
```

- [ ] **Step 3: Manual check**

Ensure hover background appears and cards feel lighter without borders.

### Task 6: Dialog polish

**Files:**
- Modify: `app/client-portal/[token]/page.tsx`
- Modify (if needed): `components/ui/dialog.tsx`

- [ ] **Step 1: Add className overrides on DialogContent**

Apply:
```tsx
<DialogContent className="rounded-3xl border border-white/8 bg-[#141414]">
```

Update confirm button:
```tsx
<Button className="rounded-full bg-emerald-500 text-white hover:bg-emerald-400" ...>
```

- [ ] **Step 2: Manual check**

Open approve dialog and verify the new look.

- [ ] **Step 3: Commit**

```bash
git add app/client-portal/[token]/page.tsx components/ui/dialog.tsx
git commit -m "ui: restyle portal comments panel and dialog"
```

## Chunk 4: Verification

### Task 7: Manual verification checklist

- [ ] **Step 1: Run dev server**

Run:
```bash
npm.cmd run dev
```
Expected: Next.js dev server starts without errors.

- [ ] **Step 2: Verify**

Checklist:
- Header blur + soft border
- Player has no border + bottom gradient
- Toolbar appears between player and input row
- Input row submits on Enter
- Comments list is minimal and hover-friendly
- Approve dialog has rounded + dark macOS feel

- [ ] **Step 3: Final commit (if needed)**

```bash
git add app/client-portal/[token]/page.tsx
git commit -m "ui: finalize client portal redesign"
```
