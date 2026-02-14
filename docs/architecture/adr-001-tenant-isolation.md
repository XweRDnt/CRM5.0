# ADR-001 Tenant Isolation

Date: 2026-02-13

## Decision
All business logic is tenant-scoped by default. Every service method takes `ServiceContext` with `tenantId` and applies tenant constraints in storage access.

## Consequences
- Safe multi-tenant behavior for MVP.
- Slightly larger method signatures.
- Clear security review checklist.
