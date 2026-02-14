# Architecture Guardrails

## Core Pipeline
- UI calls API routes only.
- API routes call service layer only.
- Service layer is the only layer that can use Prisma.

## Multi-tenant Invariant
- Every service method receives `ServiceContext` with `tenantId`.
- Every read/write query must include tenant filter.
- Cross-tenant access must raise `FORBIDDEN`.

## Error Model
- API error format:
  - `code`
  - `message`
  - `details` (optional)

## Naming
- Services: `*.service.ts`
- Jobs: `*.job.ts`
- API handlers: `app/api/**/route.ts`
- DTOs and enums: `types/index.ts`
