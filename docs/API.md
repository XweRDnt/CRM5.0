# API Documentation

Base URL: `http://localhost:3000/api`

## Authentication

All endpoints except `POST /auth/signup` and `POST /auth/login` require:

```http
Authorization: Bearer <token>
```

Status codes:
- `200` OK
- `201` Created
- `400` Validation / bad input
- `401` Unauthorized
- `403` Forbidden
- `404` Not found
- `409` Conflict
- `500` Internal server error

## Auth

### `POST /auth/signup`
Create tenant and owner user.

### `POST /auth/login`
Login with `email`, `password`, `tenantSlug`.

### `GET /auth/me`
Return current authenticated user.

## Projects

### `GET /projects`
List projects. Filters:
- `clientId`
- `status` (`DRAFT|IN_PROGRESS|CLIENT_REVIEW|COMPLETED|ON_HOLD|CANCELLED`)

### `POST /projects`
Create project and trigger default workflow stages.

Body:
```json
{
  "name": "Project Name",
  "clientId": "client-id",
  "description": "optional",
  "brief": "optional",
  "revisionsLimit": 3
}
```

### `GET /projects/:id`
Get project by id.

### `PATCH /projects/:id`
Update project fields (`name`, `description`, `status`, `clientId`, `brief`, `revisionsLimit`).

### `DELETE /projects/:id`
Delete project.

## Clients

### `GET /clients`
List tenant clients.

### `POST /clients`
Create client.

### `GET /clients/:id`
Get client by id.

### `PATCH /clients/:id`
Update client fields (`name`, `email`, `phone`, `companyName`).

### `DELETE /clients/:id`
Delete client.

## Assets

### `POST /upload`
Generate Kinescope upload session.
Requires env:
- `KINESCOPE_API_TOKEN`
- `KINESCOPE_UPLOADING_LOCATION_ID`

Body:
```json
{
  "projectId": "project-id",
  "fileName": "video.mp4",
  "fileType": "video/mp4",
  "fileSize": 10485760
}
```

Response:
```json
{
  "uploadUrl": "https://...",
  "uploadMethod": "PUT",
  "kinescopeVideoId": "video_123",
  "expiresAt": "2026-02-21T12:00:00.000Z",
  "expiresIn": 3600
}
```

### `POST /upload/confirm`
Confirm uploaded file processing state in Kinescope.

Body:
```json
{
  "projectId": "project-id",
  "kinescopeVideoId": "video_123"
}
```

Response includes:
- `processingStatus` (`UPLOADING|PROCESSING|READY|FAILED`)
- `streamUrl`
- `durationSec`

### `GET /projects/:id/versions`
List project asset versions.

### `POST /projects/:id/versions`
Create a new version after upload confirmation.

For Kinescope uploads include:
- `videoProvider: "KINESCOPE"`
- `kinescopeVideoId`
- optional `streamUrl`
- optional `processingStatus`

## Feedback

### `GET /projects/:id/feedback`
List project feedback items.

### `POST /feedback`
Create feedback item and enqueue AI parse background job.

### `PATCH /feedback/:id`
Update feedback status.

### `DELETE /feedback/:id`
Delete feedback item.

## Tasks

### `GET /tasks`
List tasks with filters:
- `projectId`
- `assignedToUserId`
- `status` (`TODO|IN_PROGRESS|DONE|CANCELLED`)
- `priority` (`LOW|MEDIUM|HIGH|URGENT`)
- `category` (`CONTENT|DESIGN|SOUND|LEGAL|OTHER`)

### `POST /tasks`
Create task.

### `PATCH /tasks/:id`
Update task (`status`, `assignedToUserId`, `dueDate`).

### `DELETE /tasks/:id`
Delete task.

### `POST /tasks/from-feedback`
Parse feedback with AI and create tasks from extracted action items.

Body:
```json
{
  "projectId": "project-id",
  "feedbackIds": ["feedback-uuid"],
  "autoAssign": true
}
```

## Scope Guard

### `POST /scope/analyze`
Analyze one feedback item against project scope with AI and create scope decision.

### `GET /scope/decisions`
List scope decisions (optional query `projectId`).

### `POST /scope/decisions/:id/decide`
PM/Owner decision on scope case (`APPROVED|REJECTED|NEEDS_INFO`).

## Workflow

### `GET /projects/:id/workflow`
List workflow stages for project.

### `POST /projects/:id/workflow/transition`
Transition project to target stage.

### `GET /projects/:id/workflow/metrics`
Return workflow stage metrics.

## AI

### `POST /ai/parse-feedback`
Manual parse of feedback items into summary + action items.

### `POST /ai/generate-summary`
Generate client-facing progress summary.

## Debug

### `GET /debug/kinescope/uploading-locations`
Requires auth (`OWNER` or `PM`).
Returns available Kinescope uploading locations (`id`, `title`, `isDefault`).
