# Remove Annotation Preview Everywhere (UI + API)

## Context
We previously removed generation of annotation preview images. However, UI and API still support the `annotationPreview` field, so legacy previews can still appear and the field is still returned in responses. The goal is to remove preview display in comments everywhere and stop returning `annotationPreview` in public/admin data flows, without database migrations.

## Goals
- Never display annotation preview images in admin or portal comment views.
- Stop returning `annotationPreview` from public API responses and feedback creation payloads.
- Keep database schema unchanged (no migration).

## Non-Goals
- Removing the database column or backfilling existing rows.
- Changing annotation data structures or drawing behavior.

## Changes
### UI
- Remove the preview image block from the admin version page comment list.
- Ensure no preview image is rendered in the client portal (no new UI added).

### API / Data Flow
- `app/api/public/portal/[token]/route.ts`: remove `annotationPreview` from Prisma `select` and response mapping.
- `app/api/public/feedback/route.ts`: remove `annotationPreview` from Zod schema, Prisma create payload, and response select.
- Remove `annotationPreview` from any client-side feedback types in portal page.

## Error Handling
No new error paths. Removing the field should not affect validation because previews are optional today. Existing clients won’t send `annotationPreview` anymore; if they do, it will be ignored by schema after removal.

## Testing
- Manual: open admin version page and verify no preview image renders for any feedback item.
- Manual: submit feedback from portal and confirm API response omits `annotationPreview`.

## Risks
- If any client still relies on `annotationPreview` in the portal response, it will stop receiving it (intended).

## Rollout
Ship as a single code change; no migrations.
