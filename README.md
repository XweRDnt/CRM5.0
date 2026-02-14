# AI CRM MVP Skeleton

This repository contains the implementation-ready scaffold for an AI CRM SaaS for video editing agencies.

## Status
- Step 1 PRD is documented.
- Step 2 skeleton is materialized in code.
- Step 3 (test-first implementation) is ready to start.

## Stack
- Next.js (App Router)
- TypeScript
- Prisma + PostgreSQL
- Tailwind + shadcn-style UI primitives
- Vitest

## Architecture Rule
`UI -> API route -> Service -> Prisma`

Direct Prisma calls from UI/routes are out of scope.

## Multi-tenant Rule
Every service method takes `ServiceContext` with `tenantId`.

## Scripts
- `npm run dev`
- `npm run lint`
- `npm run test`
- `npm run test:smoke`
- `npm run prisma:generate`
- `npm run prisma:migrate`

## Core Docs
- `docs/architecture/README.md`
- `docs/ai-workflow.md`
- `docs/quality-gates.md`
- `docs/p1-method-queue.md`

## Delivery Protocol
1. One chat = one method.
2. Write tests first.
3. Implement method.
4. Run tests.
5. Review.
6. Commit.
