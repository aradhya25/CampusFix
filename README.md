# CampusFix

CampusFix is a campus issue reporting application. The existing React/Vite client is in `client/`; the Express and MongoDB API is in `server/`.

## Run the backend

Requirements: Node.js 18+ and a reachable MongoDB instance.

1. From `server/`, copy `.env.example` to `.env` and set `MONGODB_URI` and a private, randomly generated `JWT_SECRET` (at least 32 random bytes is a good choice). Set `CLIENT_ORIGIN` to the client URL. Never commit `.env`.
2. Install dependencies with `npm install` if needed.
3. Start the API with `npm run dev` (or `npm start`). The default API address is `http://localhost:5000`.
4. Check `GET /api/health` for a process health response. Database connection errors prevent the server from listening.

Create staff using the controlled setup command, from `server/`, with `STAFF_NAME`, `STAFF_EMAIL`, and a unique `STAFF_PASSWORD` of at least 12 characters set in the environment. Run `npm run create:staff`. The command refuses to change an existing account. Public registration always creates a student and ignores a submitted role.

## API

All protected routes require `Authorization: Bearer <token>`. JSON request bodies use `Content-Type: application/json`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Health response |
| POST | `/api/auth/register` | Public | Create student (`name`, `email`, `password`) |
| POST | `/api/auth/login` | Public | Sign in (`email`, `password`) |
| POST | `/api/issues` | Student or staff | Create an issue |
| GET | `/api/issues` | Student or staff | List; students see their own, staff see all |
| GET | `/api/issues/stats` | Student or staff | Dashboard counts; student counts are personal |
| GET | `/api/issues/:id` | Student or staff | Read an issue subject to ownership |
| PATCH | `/api/issues/:id` | Student or staff | Update; students can edit their own content, staff can also set status/priority |
| DELETE | `/api/issues/:id` | Student or staff | Delete own issue; staff can delete any |

Issue fields: `title` (4–120 chars), `description` (10–2000 chars), `category` (`facilities`, `cleanliness`, `it`, `safety`, `other`), `location` (1–120 chars), `status` (`open`, `in-progress`, `resolved`, `closed`), and `priority` (`low`, `medium`, `high`). Status defaults to `open`; priority defaults to `medium`.

List query parameters: `status`, `category`, `priority`, `search`, `page` (default 1), and `limit` (default 10, maximum 100). Responses contain `issues` and pagination metadata (`page`, `limit`, `total`, `pages`). Statistics return `total`, `byStatus`, and `byCategory` maps.

## Postman test plan

Set `baseUrl` to `http://localhost:5000`; save tokens from registration/login as `studentToken` and `staffToken`.

1. Call `GET {{baseUrl}}/api/health`; expect `200` and `{ "status": "ok", "service": "campusfix-api" }`.
2. `POST /api/auth/register` with `{ "name":"A Student", "email":"student1@example.com", "password":"password123", "role":"staff" }`; expect `201`, a JWT, and `user.role` equal to `student`. Repeat with the same email; expect `409`.
3. Log in with the student credentials; expect `200`. Try a wrong password; expect `401`. Call a protected endpoint without a token; expect `401`.
4. As the student, `POST /api/issues` with `{ "title":"Broken library light", "description":"The light above desk 4 is flickering.", "category":"facilities", "location":"Main library, floor 2" }`; expect `201`, `status: open`, and `priority: medium`. Try an invalid category or short description; expect `400`.
5. Create a second student and issue. List issues as the first student; verify the second student's issue is absent. As the first student, try to fetch, patch, and delete the second student's issue ID; each should return `404`. Try to set `status` as a student; expect `400`.
6. Configure the staff variables and run `npm run create:staff`, then log in as staff. List issues and verify both students' reports are visible. Set an issue to `{ "status":"in-progress", "priority":"high" }`; expect `200`. Staff can read/delete either student's issue.
7. Test `GET /api/issues?status=in-progress&category=facilities&page=1&limit=5&search=library`; verify returned rows match all filters and pagination totals. Invalid status, page `0`, or limit `101` should return `400`.
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
