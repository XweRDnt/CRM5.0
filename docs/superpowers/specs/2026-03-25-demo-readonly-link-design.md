# Demo Read-Only Public Link Design

**Date:** 2026-03-25
**Scope:** Public demo access for a preconfigured project without login

## Goal

Add a public demo entrypoint that opens one заранее подготовленный project in the existing client portal as a strict read-only experience with no authentication and no database writes.

## Non-Goals

- Do not change internal authentication or session flows.
- Do not add new user roles or demo accounts in auth.
- Do not change billing, subscriptions, `trafficGb`, or workspace access control.
- Do not touch `AITask`, `ScopeDecision`, `WorkflowStage`, Stripe, or notification product areas.

## Constraints

- Reuse the existing `portalToken`-based public portal.
- The demo must work without login.
- The demo must not create, update, or mark anything as read in the database.
- The implementation should minimize new domain concepts and avoid schema changes.

## Configuration

Two environment variables are introduced:

- `DEMO_PROJECT_ID`: the preconfigured demo project id
- `DEMO_PORTAL_TOKEN`: the public portal token for that demo project

`DEMO_PORTAL_TOKEN` is both:

- the token accepted by `/demo/[token]`
- the token used to open the existing `/client-portal/[token]` route

No separate `DEMO_TOKEN` is needed.

## Recommended Approach

Use a thin public demo route that validates the provided token against `DEMO_PORTAL_TOKEN`, then redirects into the existing client portal with a read-only query flag.

Example flow:

1. Visitor opens `/demo/[token]`
2. Route checks `token === process.env.DEMO_PORTAL_TOKEN`
3. If valid, route redirects to `/client-portal/[token]?readonly=true`
4. Existing public portal loads the demo project via the current `portalToken` flow
5. Portal UI hides all mutating controls when `readonly=true`
6. Public mutating API endpoints reject requests for the demo token even if called directly

This keeps the shortest delivery path while preserving server-side safety.

## Route Design

### New public route

- Add `app/demo/[token]/page.tsx` or equivalent route handler/page pair
- Behavior:
  - compare URL token with `DEMO_PORTAL_TOKEN`
  - if mismatch: return `notFound()` or equivalent 404 behavior
  - if match: redirect to `/client-portal/[token]?readonly=true`

### Middleware

- No auth/session requirement for `/demo/[token]`
- Existing authentication and dashboard protections remain unchanged

## Portal Behavior

The client portal receives `readonly=true` from the URL and derives a boolean `isDemoReadonly`.

When `isDemoReadonly` is true:

- show the same project/version content as the normal client portal
- keep video playback and navigation available
- hide all write actions and composers
- optionally show a small passive note like "Demo mode: read-only"

### UI controls to hide or disable

- approve action
- new feedback/comment submission form
- thread reply composer
- any button that creates or mutates portal state

The portal should remain visually close to the real product so outreach users see the real experience, only without interactive write actions.

## Server-Side Protection

UI hiding is not sufficient. The server must reject demo writes explicitly.

Create a shared helper:

- `isDemoToken(token: string): boolean`

Behavior:

- returns `true` only when the token exactly matches `process.env.DEMO_PORTAL_TOKEN`
- safe to use across public routes

Use this helper in mutating public endpoints to reject demo requests before any write occurs.

### Mutating routes that must reject demo mode

- public approve route
- public feedback creation route
- public feedback thread reply route
- public feedback thread read-mark route

### Rejection behavior

- respond with `403` or another explicit non-success status
- return a small machine-readable error such as:
  - `code: "DEMO_READONLY"`
  - `message: "Demo mode is read-only"`

This ensures "no writes at all" even if someone bypasses the portal UI.

## Data Model

No schema changes are required.

The existing source of truth remains:

- project selected by `DEMO_PROJECT_ID`
- portal access controlled by `DEMO_PORTAL_TOKEN`

The implementation assumes operational setup will ensure the configured project and token correspond to the same project.

## Operational Setup

Before using the demo link:

1. Pick a stable demo project in the database
2. Ensure that project has a valid `portalToken`
3. Copy its id into `DEMO_PROJECT_ID`
4. Copy its `portalToken` into `DEMO_PORTAL_TOKEN`

The app should not generate demo tokens automatically in this first version.

## Validation Rules

- `/demo/[wrong-token]` returns 404
- `/demo/[demo-token]` redirects correctly
- redirected portal opens without login
- demo portal shows content normally
- approve action is absent or disabled
- feedback creation UI is absent or disabled
- thread reply UI is absent or disabled
- direct POST requests to public mutating routes with the demo token are rejected
- demo flow does not create read markers

## Testing Strategy

### Route tests

- verify `/demo/[token]` rejects invalid token
- verify `/demo/[token]` redirects valid token to `/client-portal/[token]?readonly=true`

### Portal component tests

- verify `readonly=true` hides approve and comment/reply controls
- verify read-only note renders if added

### API tests

- verify demo token cannot approve
- verify demo token cannot create feedback
- verify demo token cannot reply in thread
- verify demo token cannot mark thread as read

### Regression focus

- normal public portal with a non-demo token still behaves exactly as before
- normal authenticated dashboard behavior remains unchanged

## Risks

### Risk: UI-only protection leaves write holes

Mitigation: reject demo writes in server routes with `isDemoToken`.

### Risk: config drift between `DEMO_PROJECT_ID` and `DEMO_PORTAL_TOKEN`

Mitigation: keep both env vars documented and use them only for operational setup and route validation in this version.

### Risk: read-only query flag affects non-demo links

Mitigation: scope portal UI behavior to explicit `readonly=true` and keep server write rejection tied only to `isDemoToken`.

## Decision Summary

- Use `/demo/[token]` as the public entrypoint
- Reuse existing `portalToken` client portal
- Use only `DEMO_PROJECT_ID` and `DEMO_PORTAL_TOKEN`
- Treat `DEMO_PORTAL_TOKEN` as both URL token and portal token
- Enforce read-only both in UI and in public mutating routes
- Block read-mark writes too, so demo creates zero database writes
