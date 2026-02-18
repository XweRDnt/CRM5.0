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
- `npm run typecheck`
- `npm run test`
- `npm run test:api`
- `npm run test:services`
- `npm run test:critical`
- `npm run test:smoke`
- `npm run prisma:generate`
- `npm run prisma:migrate`

## Local Environment (Required)
1. Start infrastructure:
   - `docker compose up -d postgres redis`
2. Ensure `DATABASE_URL` points to local Postgres.
   - Default expected value: `postgresql://postgres:postgres@localhost:5432/video_crm?schema=public`
3. Apply migrations:
   - `npm run prisma:test:migrate`
4. (Optional) Telegram notifications for public feedback/approval:
   - `TELEGRAM_BOT_TOKEN=<your_bot_token>`
   - `TELEGRAM_CHAT_ID=<target_chat_id>`

## Critical Validation Pipeline
- `npm run test:critical`

This command runs:
1. `lint`
2. `typecheck`
3. `smoke tests`
4. `API tests` (auto-starts Next API server for tests)
5. `service/job integration tests` (with DB preflight check)

## Common Failures
- `ECONNREFUSED 127.0.0.1:3000`:
  API test server is not running or failed to start. Run `npm run test:api` (it auto-starts server), and inspect logs.
- `Can't reach database server at localhost:5432`:
  Postgres is unavailable. Run `docker compose up -d postgres redis` and retry.

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
