# CampusFix

CampusFix is a campus issue reporting application. The existing React/Vite client is in `client/`; the Express and MongoDB API is in `server/`.

## Run the backend

Requirements: Node.js 18+ and a reachable MongoDB instance.

1. From `server/`, copy `.env.example` to `.env` and set `MONGODB_URI` and a private, randomly generated `JWT_SECRET` (at least 32 random bytes is a good choice). Set `CLIENT_ORIGIN` to the client URL. Never commit `.env`.
2. Install dependencies with `npm install` if needed.
3. Start the API with `npm run dev` (or `npm start`). The default API address is `http://localhost:5000`.
4. Check `GET /api/health` for a process health response. Database connection errors prevent the server from listening.
5. Optional SLA targets can be set in `server/.env` with `SLA_TARGET_URGENT_HOURS`, `SLA_TARGET_HIGH_HOURS`, `SLA_TARGET_MEDIUM_HOURS`, and `SLA_TARGET_LOW_HOURS`. Defaults are 4, 24, 72, and 120 hours respectively. Values must be positive numbers; invalid values fall back to defaults.
6. To enable photo uploads, create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env`. Restart the backend after configuration. Without these values, normal JSON issue creation works and image uploads return `503`.

Create staff using the controlled setup command, from `server/`, with `STAFF_NAME`, `STAFF_EMAIL`, and a unique `STAFF_PASSWORD` of at least 12 characters set in the environment. Run `npm run create:staff`. The command refuses to change an existing account. Public registration always creates a student and ignores a submitted role.

## Run the frontend

From `client/`, copy `.env.example` to `.env.local` if the API is not at the local default, set `VITE_API_URL` (including `/api`), then run `npm install` if needed and `npm run dev`. Vite prints the local client URL, normally `http://localhost:5173`. The default API URL is `http://localhost:5000/api`. Start the backend and connect it to MongoDB for login, registration, and dashboard data. The browser client stores the JWT for the current tab session and clears it on logout or an expired/invalid authenticated request.

## API

All protected routes require `Authorization: Bearer <token>`. JSON requests use `Content-Type: application/json`; issue creation also accepts `multipart/form-data` when uploading an optional photo.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health response |
| POST | `/api/auth/register` | Public | Create student (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Public | Sign in (`email`, `password`) |
| POST | `/api/issues` | Student or staff | Create an issue |
| GET | `/api/issues` | Student or staff | List; students see their own, staff see all |
| GET | `/api/issues/stats` | Student or staff | Dashboard counts; student counts are personal |
| GET | `/api/issues/:id` | Student or staff | Read an issue subject to ownership |
| PATCH | `/api/issues/:id` | Student or staff | Students edit own content; staff can set status/priority and resolution notes |
| DELETE | `/api/issues/:id` | Student or staff | Delete own issue; staff can delete any |

Issue fields: `title` (4–120 chars), `description` (10–2000 chars), `category` (`facilities`, `cleanliness`, `it`, `safety`, `other`), `location` (1–120 chars), `status` (`open`, `in-progress`, `resolved`, `closed`), and `priority` (`low`, `medium`, `high`, `urgent`). Status defaults to `open`; priority defaults to `medium`.

List query parameters: `status`, `category`, `priority`, `search`, `page` (default 1), `limit` (default 10, maximum 100), and `sort` (`newest`, `oldest`, or `priority`; default `newest`). Priority sort orders urgent, high, medium, then low, with newest first within each priority. Responses contain `issues` and pagination metadata (`page`, `limit`, `total`, `pages`). Statistics return `total`, `byStatus`, and `byCategory` maps.

Issue creation accepts `title`, `description`, `category`, `location`, and optional `priority`. Priority supports `low`, `medium`, `high`, and `urgent`, and defaults to `medium`. Students can edit or delete their own issues. Staff can update status and priority and save optional `resolutionNotes` (up to 2000 characters); those notes are displayed in issue details.

New issues receive a server-generated `activity` entry for their report. Each staff status transition appends an entry containing the prior and next status, staff actor, timestamp, and current resolution note (if provided). Clients cannot submit or edit `activity`; student access and issue ownership rules still apply. Existing issues created before activity tracking may have an empty activity history.

Issue list, create, read, and update responses include an additive `sla` object calculated on the server from `createdAt`, priority, and configured target hours: `{ "ageHours": 25, "targetHours": 24, "dueAt": "...", "isOverdue": true }`. Open and in-progress issues are marked overdue after their target; resolved and closed issues are never marked overdue. Statistics keep their existing `{ total, byStatus, byCategory }` response shape.

### Photo attachments

`POST /api/issues` remains JSON-compatible. With a photo, send the same issue fields as `multipart/form-data` and add one file field named `image`. The authenticated backend accepts JPEG, PNG, and WebP up to 5 MB. It validates the MIME type and file signature, uploads to the private-configured Cloudinary account, and only then saves the issue with an `image` object containing its HTTPS URL, Cloudinary public ID, format, MIME type, and byte size. Existing issues without an `image` remain valid. Upload failure returns `502` and creates no issue; the response includes a sanitized `providerError` object (`httpStatus`, `errorCode`, and `message`) for troubleshooting, with no credentials or signatures. If the database save fails after Cloudinary succeeds, the backend attempts to remove the unreferenced upload. A missing Cloudinary configuration returns `503` for image uploads only.

Cloudinary credentials belong only in `server/.env` (see `server/.env.example`). Never add them to React source, `client/.env`, `VITE_*`, or Git. The backend uses a signed upload with the configured Cloudinary product environment API key and secret. If Cloudinary returns HTTP 403, check the key assigned to that product environment in **Console Settings > API Keys** (or **Console Settings > Role Management > API Keys** on accounts using the new permissions system): the key must have permission to create uploads. Also check any account or product-environment upload restrictions. The live error observed during this fix was `Request forbidden due to missing permissions (actions=["create"])`; no credential values are included in the diagnostic. The uploaded image is displayed in the expanded issue details in student and staff dashboards. Images can be attached during issue creation; changing/removing a stored image is not exposed through the issue update API.

Postman photo request: select `POST {{baseUrl}}/api/issues`, set Authorization to Bearer `{{studentToken}}`, choose Body → form-data, add text fields `title`, `description`, `category`, `location`, and `priority`, then add a File field named `image` and select a JPEG, PNG, or WebP no larger than 5 MB. Expect `201` and `{ "issue": { ..., "image": { "url": "https://...", "publicId": "...", "format": "png", "mimeType": "image/png", "bytes": 12345 } } }`. To verify persistence after reload, call authenticated `GET {{baseUrl}}/api/issues/{{issueId}}`; the `issue.image.url` field remains in the response. Invalid type/signature returns `400`, oversize returns `413`, missing token returns `401`, and missing Cloudinary configuration returns `503`.

## Postman test plan

Set `baseUrl` to `http://localhost:5000`; save tokens from registration/login as `studentToken` and `staffToken`.

1. Call `GET {{baseUrl}}/api/health`; expect `200` and `{ "status": "ok", "service": "campusfix-api" }`.
2. `POST /api/auth/register` with `{ "name":"A Student", "email":"student1@example.com", "password":"password123", "role":"staff" }`; expect `201`, a JWT, and `user.role` equal to `student`. Repeat with the same email; expect `409`.
3. Log in with the student credentials; expect `200`. Try a wrong password; expect `401`. Call a protected endpoint without a token; expect `401`.
4. As the student, `POST /api/issues` with `{ "title":"Broken library light", "description":"The light above desk 4 is flickering.", "category":"facilities", "location":"Main library, floor 2", "priority":"urgent" }`; expect `201`, `status: open`, and `priority: urgent`. Repeat for `low`, `medium`, and `high`; omit priority once and verify the `medium` default. Try an invalid priority, category, or short description; expect `400`.
5. Create a second student and issue. List issues as the first student; verify the second student's issue is absent. As the first student, try to fetch, patch, and delete the second student's issue ID; each should return `404`. Try to set `status` as a student; expect `400`.
6. Configure the staff variables and run `npm run create:staff`, then log in as staff. List issues and verify both students' reports are visible. Set an issue to `{ "status":"in-progress", "priority":"high", "resolutionNotes":"Replaced the faulty fixture." }`; expect `200`. Staff can read/delete either student's issue.
7. Test `GET /api/issues?status=in-progress&category=facilities&priority=urgent&page=1&limit=5&search=library&sort=priority`; verify returned rows match all filters and pagination totals. Test `sort=newest` and `sort=oldest`. Invalid status, sort, page `0`, or limit `101` should return `400`.
8. Call `/api/issues/stats` as staff and as a student; compare global counts with the student's personal counts. Call an unknown path; expect a JSON `404`.

## Verify

From `server/`, run `npm test` for the database-independent health and not-found route tests. Authentication and issue persistence require MongoDB; the Postman plan above covers those integration paths.

### Query endpoint details

`GET /api/issues` accepts `status`, `category`, `priority`, `search`, `page` (default 1), and `limit` (default 10, maximum 100). Page and limit must be positive safe integers, and the computed offset must remain safe. Search checks `title`, `description`, and `location` with a case-insensitive substring match; input is limited to 100 characters and regular-expression metacharacters are escaped. Filters combine with AND, while a search match can come from any of the three fields. Students only search their own issues; staff search all issues.

Example Postman request (staff token):

```http
GET {{baseUrl}}/api/issues?status=in-progress&category=facilities&search=library&page=1&limit=5
Authorization: Bearer {{staffToken}}
```

Expected response:

```json
{
  "issues": [{ "_id": "…", "title": "Library light", "status": "in-progress" }],
  "pagination": { "page": 1, "limit": 5, "total": 1, "pages": 1 }
}
```

Invalid status/category/priority, non-positive or non-integer page/limit, limit above 100, unsafe offset, or search longer than 100 characters returns `400` with a JSON `message`. Empty results return `200`, `issues: []`, and `pages: 0`.

`GET /api/issues/stats` requires a Bearer token. Staff counts are global; student counts include only that student's issues. The response includes each supported status with zeroes when no issue has that status. `total` equals the sum of `byStatus` counts.

Example Postman request:

```http
GET {{baseUrl}}/api/issues/stats
Authorization: Bearer {{studentToken}}
```

Expected response shape:

```json
{
  "total": 3,
  "byStatus": { "open": 2, "in-progress": 0, "resolved": 1, "closed": 0 },
  "byCategory": { "facilities": 3 }
}
```

Run `npm test` in `server/` for the health/not-found tests and mocked issue-route tests. The issue tests exercise Express routing, JWT verification, student/staff scoping, every status filter, search escaping, and pagination with fixture data; they do not verify MongoDB query execution or persistence. For that, set up MongoDB and follow the Postman plan with real student/staff tokens.

### Activity and SLA verification

After a staff member changes an issue status, retrieve its details with `GET {{baseUrl}}/api/issues/{{issueId}}` and a valid Bearer token. The response is `{ "issue": { ..., "activity": [{ "action": "reported", "fromStatus": null, "toStatus": "open", "actor": { "name": "A Student", "role": "student" }, "changedAt": "..." }, { "action": "status-change", "fromStatus": "open", "toStatus": "in-progress", "actor": { "name": "Campus Staff", "role": "staff" }, "note": "...", "changedAt": "..." }], "sla": { ... } } }`. As a student, use only an issue you own; trying another issue returns `404`. Attempting to send `activity` in a PATCH request returns `400`.

SLA utility tests and mocked route tests run without MongoDB. The route test suite uses fake model results, so a live MongoDB connection is still needed to verify embedded activity persistence, populated actor data, and end-to-end issue create/status transitions. Use the Postman detail request above after starting MongoDB and the API.

Photo upload route tests mock Cloudinary and MongoDB model writes. They cover unauthenticated uploads, invalid MIME/signature, oversize rejection, successful metadata persistence, provider failure, and cleanup after a failed database save. They do not contact Cloudinary or MongoDB. Configure real Cloudinary credentials and a reachable MongoDB instance, then follow the Postman photo request to verify provider credentials, durable storage, and image display in both dashboards.
