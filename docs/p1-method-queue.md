# P1 Method Queue

## 1. AuthService.signup
- Goal: register tenant + owner user.
- Input: tenantName, ownerName, email, password.
- Output: token + owner profile.
- Happy path: new tenant and user are created.
- Edge cases: duplicate email, weak password, transaction rollback, invalid payload.
- DoD: tests for happy + failure paths, tenant-scoped user created.

## 2. AuthService.login
- Goal: authenticate user.
- Input: email, password.
- Output: JWT + user context.
- Happy path: valid credentials return token.
- Edge cases: wrong password, unknown email, inactive user, tenant mismatch.
- DoD: invalid credentials never leak details.

## 3. AuthService.verifyToken
- Goal: protect API by JWT verification.
- Input: bearer token.
- Output: ServiceContext.
- Happy path: valid token returns tenant/user context.
- Edge cases: expired token, malformed token, missing tenantId.
- DoD: unauthorized requests return standard error envelope.

## 4. ProjectService.createProject
- Goal: create project in tenant scope.
- Input: clientAccountId, name, metadata.
- Output: project record.
- Happy path: project created and linked to client.
- Edge cases: foreign client tenant, missing client, invalid due date.
- DoD: cross-tenant client link blocked.

## 5. ProjectService.listProjects
- Goal: list tenant projects.
- Input: tenant context, optional filters.
- Output: project list.
- Happy path: returns only tenant projects.
- Edge cases: empty result, status filter, unauthorized role.
- DoD: no cross-tenant leakage in tests.

## 6. ClientService.createClient
- Goal: create client account in tenant.
- Input: companyName, contactName, email.
- Output: client record.
- Happy path: client created.
- Edge cases: duplicate email policy, invalid email, missing fields.
- DoD: tenant-scoped uniqueness behavior covered.

## 7. AssetService.createVersion
- Goal: create video asset version metadata.
- Input: projectId, versionNo, file metadata.
- Output: version record.
- Happy path: version created.
- Edge cases: version collision, project not found, foreign tenant project.
- DoD: unique (projectId, versionNo) verified.

## 8. StorageService.getUploadUrl
- Goal: issue presigned upload URL.
- Input: file metadata.
- Output: url + object key.
- Happy path: valid URL returned.
- Edge cases: unsupported mime type, oversized file, expired creds.
- DoD: validation + signing failure covered.

## 9. FeedbackService.createFeedback
- Goal: create feedback item for version.
- Input: assetVersionId, text, timecode.
- Output: feedback record.
- Happy path: feedback saved.
- Edge cases: empty text, invalid timecode, unknown version.
- DoD: validation and tenant scope asserted.

## 10. FeedbackService.getFeedbackByVersion
- Goal: list feedback by version.
- Input: version id.
- Output: feedback list.
- Happy path: ordered list by createdAt.
- Edge cases: no feedback, foreign tenant version.
- DoD: list is tenant-safe and deterministic.

## 11. AIService.parseFeedback
- Goal: convert feedback into action items.
- Input: feedback texts.
- Output: parsed action items.
- Happy path: returns normalized list.
- Edge cases: empty feedback set, low confidence results, provider timeout.
- DoD: provider responses mocked in tests.

## 12. TaskService.createTask
- Goal: create task from parsed AI action item.
- Input: projectId, summary, priority.
- Output: task record.
- Happy path: task created and linked to project.
- Edge cases: invalid priority, unknown project, foreign tenant project.
- DoD: source feedback ids are persisted.

## 13. Job handleAIParseFeedback
- Goal: async pipeline feedback -> tasks.
- Input: feedback IDs.
- Output: created task count.
- Happy path: tasks created for valid AI output.
- Edge cases: partial provider failure, duplicate tasks, retry idempotency.
- DoD: retries are safe and deterministic.
