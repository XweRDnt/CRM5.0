# First Project Flow And Client Removal Design

**Date:** 2026-03-27

## Goal

Remove the `Client` domain entity from the product, API, and database, then rebuild the first-project flow so a new workspace can create a project and upload its first video with minimal friction.

## Product Direction

The product should optimize for the user's first meaningful result:

1. create a workspace account
2. create a project
3. upload the first version
4. continue review work from inside the project

`Client` is no longer part of this activation path and is removed entirely instead of being hidden behind compatibility layers.

## User Experience

### Registration

The signup screen keeps only:

- `workspaceName`
- `email`
- `password`

The page should visually match the authenticated product shell:

- same glass / blur language as the internal dialogs
- same color system, spacing, radius, and button treatment
- no separate marketing-style auth visual language

Successful signup should route directly into the first-project experience instead of dropping the user onto a generic list and asking them to choose the next action.

### First Project Creation

Project creation becomes a modal flow, not a standalone admin form page.

The modal should:

- use the same blur dialog treatment as existing in-product actions
- focus on a single required field: `Project name`
- remove `description`, `client`, `revisionsLimit`, and `brief`
- feel like a launch action, not a back-office record form

The first-run experience should open this modal immediately after signup and should also be reusable from the normal projects page.

### Version Upload

Version upload should use the same blur/glass modal language and feel like the natural continuation of project creation.

The upload experience should:

- use a large drag-and-drop target that occupies most of the modal body
- support dropping a file anywhere in the active upload surface
- default the editable version title to `Версия N`
- compute the sequence number automatically from existing versions
- remove manual version number input entirely
- allow the user to overwrite the generated version title with custom text

After successful upload, the user should land inside the created project with the uploaded version visible.

## Domain Model Changes

### Remove `Client`

Delete the `Client` model and all direct and indirect dependencies:

- Prisma model and relations
- project foreign keys and indexes tied to `clientId`
- API routes under `/api/clients`
- services, validators, and response types for clients
- UI pages and forms for client list/detail/create/edit
- tests that depend on client records

### Simplify `Project`

Project creation should require only:

- `name`

All project creation code should be updated so no client association is expected anywhere in validation, persistence, rendering, or test fixtures.

### Simplify Asset Version Metadata

Versions should keep:

- internal numeric ordering for stable sequencing
- user-facing editable `title` or equivalent display field

The numeric sequence remains system-managed. The user edits the display title only.

## API Changes

### Signup

`POST /api/auth/signup` should accept:

- `workspaceName`
- `email`
- `password`

`firstName` and `lastName` should be removed from validation and storage requirements if they are not required elsewhere.

### Projects

`POST /api/projects` should accept only the minimal payload needed to create a project:

- `name`

Any obsolete fields should be removed from schema validation and callers.

### Versions

Version creation endpoints and helpers should stop expecting user-entered version numbers.

They should instead:

- derive the next sequence number server-side
- accept an optional editable display title from the UI
- generate a default title when none is provided

## UI Architecture

### Reuse Existing Dialog System

Do not invent a second modal pattern. Extend the existing dialog primitives and styling so:

- `Create Project`
- `Upload Version`
- future in-project launch actions

all share one polished SaaS dialog pattern.

### Projects Page

The projects page should become the home for the creation flow:

- empty state CTA opens the create-project modal
- header CTA opens the same modal
- first-run entry can auto-open the modal

### Project Detail

A newly created project with no versions should strongly direct the user to upload the first version, ideally by opening the upload modal immediately in the first-run path.

## Data Migration

The database migration should:

1. remove `clientId` from `Project`
2. drop the `Client` table and dependent constraints
3. preserve projects and versions
4. ensure existing projects remain queryable without client joins

Seed data and test fixtures must be rewritten to stop creating clients before projects.

## Testing Strategy

Coverage should focus on behavior changes, not just snapshots.

Required test areas:

- signup accepts the new minimal payload and rejects removed-field assumptions
- project creation works without client data
- project lists and cards render without client names
- create-project modal enforces only project name
- upload flow auto-generates `Версия N`
- upload flow allows overriding the default version title
- old client routes and UI are removed cleanly

## Risks

### Migration Risk

Removing `Client` touches schema, services, API, types, and tests at once. The main risk is stale assumptions in less-visible code paths.

### UX Consistency Risk

If signup, create-project, and upload dialogs are redesigned independently, the product can still feel inconsistent. A single dialog visual system should drive all three.

### Version Naming Risk

The system must clearly distinguish between:

- internal sequence number
- user-facing editable version title

This should be explicit in the implementation to avoid breaking review logic that relies on ordering.

## Recommended Rollout

Implement as one coordinated refactor in this order:

1. schema and types
2. API and services
3. project list/detail rendering
4. create-project modal flow
5. upload modal redesign and version-title changes
6. signup redesign and first-run redirect
7. regression tests and cleanup

## Success Criteria

The redesign is successful when a new user can:

1. sign up with workspace name, email, and password
2. create a project from a single-field modal
3. upload the first video from a polished full-surface drag-and-drop modal
4. never encounter the `Client` concept anywhere in the product
