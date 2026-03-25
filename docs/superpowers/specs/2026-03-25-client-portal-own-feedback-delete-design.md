# Client Portal Own Feedback Delete Design

**Date:** 2026-03-25
**Scope:** Allow guest portal users to delete only feedback items they created on the current device

## Goal

Add a lightweight delete flow in the client portal so a guest user can remove only the feedback items they personally created on the current device/session, without introducing guest accounts or full identity/auth flows.

## Non-Goals

- Do not add portal login or guest authentication.
- Do not infer ownership by `authorName`.
- Do not add cross-device ownership sync.
- Do not change internal dashboard feedback deletion rules.
- Do not change thread ownership semantics in this first version.

## Product Decision

Ownership is device-local.

A feedback item is considered "mine" only if its `feedback.id` was recorded in `localStorage` on this browser after successful creation.

Consequences:

- Same name on a different device does not grant delete access.
- Clearing browser storage removes delete access for previously created feedback.
- This is acceptable for the guest-portal MVP because it is predictable and requires no new auth model.

## UX

### Desktop

- Right click on an owned feedback card opens a delete affordance.
- The interaction should not affect non-owned items.
- The browser default context menu should be suppressed only for owned items when we intend to show delete UI.

### Mobile

- Long press on an owned feedback card opens the same delete affordance.
- The long-press threshold should be intentional, around 450-600ms.
- Short taps should continue to behave as they do now, including opening the thread.

### Confirmation

- Deletion must be confirmed before the write happens.
- Keep the confirmation lightweight:
  - either a small context menu followed by confirm
  - or directly a confirm dialog/sheet after right click / long press

Recommended first version:

- right click / long press directly opens a confirm dialog
- no separate action menu needed yet

This is the shortest path and avoids extra UI complexity.

## Data Model

No database schema changes.

## Local Storage Model

Add a dedicated local storage key for portal-owned feedback ids, for example:

- `portal_owned_feedback_ids:${token}`

Recommended value shape:

```json
["feedback_id_1", "feedback_id_2"]
```

Token scoping avoids mixing ownership between different client portals in the same browser.

## Portal Behavior

### On feedback creation

After successful `POST /api/public/feedback`:

- read the returned feedback id
- persist it into the token-scoped local storage list
- keep the in-memory portal UI in sync

### On render

For each feedback item:

- derive `isOwnedByCurrentDevice` from the local storage id set
- only owned items get delete interactions

### On delete success

- remove the feedback item from local UI
- remove the id from local storage
- if the deleted feedback thread is open, close the thread panel
- clear any thread-local state for that feedback id

## Server Design

The client-side ownership check is only for UX.
The server still needs a public delete endpoint scoped to the portal token.

### New public endpoint

Recommended route:

- `DELETE /api/public/feedback/[id]`

Request body:

```json
{
  "token": "<portal token>"
}
```

### Validation

The route must:

1. validate the portal token
2. verify that the feedback item belongs to the project identified by that token
3. reuse existing service deletion logic where possible
4. reject demo tokens

### Ownership enforcement

In this first version, true ownership remains client-enforced via local storage.
Server-side route authorization is scoped to:

- "this feedback belongs to this portal token"

not:

- "this browser originally created it"

This is acceptable only because the delete affordance is hidden for non-owned items and the portal itself is already a shared guest link.

If stronger guarantees are needed later, the next step would be a client identity token or signed delete capability, but that is explicitly out of scope here.

## Interaction Details

### Desktop event handling

- attach `onContextMenu` only where needed
- for owned items:
  - `preventDefault()`
  - open confirmation UI for that feedback item
- for non-owned items:
  - do nothing special

### Mobile long press

- use pointer/touch start + timeout
- cancel on:
  - pointer/touch end
  - pointer move beyond small threshold
  - scroll or cancel
- only trigger for owned items

### Existing click behavior

- regular click/tap on a feedback item should continue opening the thread
- long press should not accidentally also trigger the normal open-thread click

## Error Handling

### Client

- show success toast after delete
- show error toast on failure
- avoid leaving local storage or UI in partially updated state

### Server

- `400` invalid token
- `403` demo readonly
- `404` feedback not found in this portal
- `200` or `204` on successful deletion

## Tests

### Portal component tests

- created feedback id is stored locally after successful creation
- owned feedback responds to right click with delete confirmation
- non-owned feedback does not expose delete
- long press on mobile owned feedback opens delete confirmation
- successful delete removes item from UI and local storage

### Public API tests

- delete succeeds for feedback belonging to the same portal token
- delete fails for feedback belonging to another portal token
- delete fails for invalid token
- delete fails for demo token

### Regression tests

- normal tap/click still opens thread
- demo readonly mode still hides mutating actions, including delete

## Risks

### Risk: local-only ownership is bypassable by a technical user

Mitigation:

- accept this limitation for guest MVP
- keep delete route scoped to correct portal token
- revisit only if abuse appears in practice

### Risk: long press interferes with existing mobile interactions

Mitigation:

- apply only to feedback cards
- use movement threshold and cancellation
- keep long-press timing conservative

### Risk: deleting feedback with open thread leaves stale UI

Mitigation:

- remove related thread state and close active thread if deleted

## Decision Summary

- Deletion is allowed only for feedback ids stored in token-scoped local storage on the current device
- Desktop uses right click
- Mobile uses long press
- First version uses direct confirmation instead of a separate context menu
- Public delete route is portal-token-scoped
- No auth, schema, or dashboard-role changes
