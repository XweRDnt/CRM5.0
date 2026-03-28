# Memory Bank

## Product context
- Project: `video-crm-mvp`
- Main production domain: `https://xn--80aeshwg.xyz`
- User priority: make the non-admin product feel fast, light, smooth, and stable on desktop and mobile.
- Constraint from this chat: do not touch `app/(dashboard)/admin/**` and `app/api/admin/**` while another agent is working there.

## What was audited
- Frontend UX/perf:
  - dashboard shell was client-first and caused extra auth waits.
  - several user pages were client-first SWR pages instead of server-first routes.
  - project entry and version entry loaded more data than needed for redirect flow.
  - version detail page remains the heaviest route and likely the main source of remaining mobile micro-freezes.
  - `ProjectCard` had extra client-side observer/listener work.
- Backend / infra:
  - server capacity itself was not the main bottleneck.
  - deploy flow was fragile and previously caused `.next` chunk/build inconsistencies.
  - health-check originally did not verify dependencies.
  - production had historical Redis reconnect noise and low observability.

## Implemented changes
- Added server-first user route shells and initial data loading for:
  - `/projects`
  - `/team`
  - `/scope`
  - `/settings`
- Added dashboard user context to reduce repeated client auth checks inside nested routes.
- Switched project and version entry to use latest-version lookup instead of loading/sorting full version lists just to redirect.
- Removed extra theme observer styling work from `ProjectCard`.
- Added real dependency-aware health checks for database and Redis.
- Added `Server-Timing` to key non-admin API routes.
- Hardened deploy workflow:
  - `npm ci`
  - stop app before build
  - clear `.next`
  - use local Prisma binaries from `node_modules/.bin`
  - health check `/api/health`
- Stabilized production builds by switching `npm run build` to `next build --webpack`.

## Production incidents during this chat
- After the first broad perf deploy, production returned `502 Bad Gateway`.
- Root causes found:
  - server-side `scope` page returned Prisma values that did not match `ScopeDecisionResponse` shape.
  - Turbopack production build path was unstable and produced missing build artifacts / lock issues.
  - `npx prisma` on the server could resolve to Prisma 7 instead of the repo's Prisma 6.
- Resolved by:
  - fixing scope decision mapping.
  - switching prod build to webpack.
  - using local Prisma binaries for deploy/recovery.

## Important commits from this chat
- `c866ebe` `Improve user runtime performance and health checks`
- `f6e45b2` `Fix scope decisions server mapping`
- `59fa9b8` `Stabilize production build with webpack`

## Current known-good production state
- Production server was confirmed on commit `59fa9b82437232bf785a6059d579293c9dac1ecf`.
- `pm2` processes `video-crm-mvp` and `video-crm-worker` were verified `online`.
- Public health endpoint returned:
  - `{"data":{"status":"ok","dependencies":{"database":"ok","redis":"ok"}}}`

## Remaining known risks / next work
- The version detail page is still the biggest client-side hot path and should be split into lighter islands.
- Some repo-wide TypeScript / Prisma typing problems still exist outside the scope of these changes, especially around admin and older service files.
- Local Windows environment can fail `next build` with `spawn EPERM`; production verification should continue to rely on VPS builds until that workstation issue is resolved.

## Security note
- VPS access credentials were shared in chat for operational recovery.
- Plaintext secrets are intentionally not copied into this file or the repository.
