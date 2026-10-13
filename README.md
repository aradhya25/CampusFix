# CampusFix

CampusFix is a campus issue reporting portal for students and staff. Students can report and track campus issues; staff can review the shared queue and update status, priority, and resolution notes.

## Features

- Student registration and sign in, plus administrator provisioned staff accounts.
- Issue reporting, editing, cancellation, search, filtering, sorting, pagination, and dashboard counts.
- Staff status and priority updates, resolution notes, and issue activity history.
- Optional JPEG, PNG, or WebP issue photos stored in Cloudinary (maximum 5 MB).
- Server calculated issue age and priority based resolution targets, with overdue indicators for unresolved reports.
- Responsive React interface with form feedback, loading and error states, and keyboard focus indicators.

## Technology and architecture

- **Client:** React 19, Vite, JavaScript, CSS.
- **API:** Node.js, Express 5, JWT authentication, Multer for in-memory image validation.
- **Data:** MongoDB with Mongoose.
- **Image storage:** Cloudinary signed uploads; credentials stay on the server.

The `client/` app communicates with the JSON API under `/api`. Express routes in `server/src/routes/` authenticate users, enforce student ownership and staff permissions, validate requests, and use the Mongoose models in `server/src/models/`. Image uploads are signature checked before Cloudinary; the issue is saved only after a successful upload. SLA targets are calculated from stored creation timestamps and are returned as additive response data.

## Project structure

```text
CampusFix/
├── client/                 # React/Vite browser application
│   └── src/
│       ├── components/     # Shared layout, form, and issue components
│       ├── hooks/          # Dashboard data loading
│       ├── pages/          # Authentication, report, student, and staff views
│       └── services/       # API and notification helpers
└── server/                 # Express API
    ├── scripts/            # Controlled staff-account bootstrap
    ├── src/
    │   ├── middleware/     # Authentication, validation, image and error handling
    │   ├── models/         # Mongoose User and Issue models
    │   ├── routes/         # Auth and issue endpoints
    │   └── services/       # Cloudinary integration
    └── test/               # Node.js automated tests
```

Each application has its own `package.json` and lockfile. Install and run dependencies from the corresponding `client/` or `server/` directory.

## Local setup

Requirements: Node.js 18 or newer, npm, and a reachable MongoDB instance. Cloudinary credentials are needed only when testing photo uploads.

1. In `server/`, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell). Set `MONGODB_URI`, a long random `JWT_SECRET`, and `CLIENT_ORIGIN` (normally `http://localhost:5173`).
2. In a terminal opened in `server/`, run `npm install`, then `npm run dev`. The API listens on port `5000` by default. Check `GET http://localhost:5000/api/health`.
3. In `client/`, copy `.env.example` to `.env.local` if needed (`Copy-Item .env.example .env.local`). Set `VITE_API_URL` to the API base including `/api` (default `http://localhost:5000/api`). In a terminal opened in `client/`, run `npm install` and `npm run dev`.
4. Open the URL printed by Vite (normally `http://localhost:5173`) and register a student account.
5. To provision staff, set `STAFF_NAME`, `STAFF_EMAIL`, and `STAFF_PASSWORD` in `server/.env`, then run `npm run create:staff` from `server/`. Staff passwords must be at least 12 characters. The command will not modify an existing account. Public registration always creates a student, regardless of submitted role fields.

### Environment variables

| Variable                                      | Location | Purpose                                                |
| --------------------------------------------- | -------- | ------------------------------------------------------ |
| `PORT`                                        | server   | API port; defaults to `5000`.                          |
| `MONGODB_URI`                                 | server   | MongoDB connection string.                             |
| `JWT_SECRET`                                  | server   | Private token signing secret; use a long random value. |
| `JWT_EXPIRES_IN`                              | server   | Token lifetime; defaults to `1d`.                      |
| `CLIENT_ORIGIN`                               | server   | Allowed browser origin(s), comma separated.            |
| `CLOUDINARY_CLOUD_NAME`                       | server   | Optional Cloudinary product environment.               |
| `CLOUDINARY_API_KEY`                          | server   | Optional Cloudinary API key.                           |
| `CLOUDINARY_API_SECRET`                       | server   | Optional private Cloudinary secret.                    |
| `SLA_TARGET_URGENT_HOURS`                     | server   | Urgent target; default `4`.                            |
| `SLA_TARGET_HIGH_HOURS`                       | server   | High target; default `24`.                             |
| `SLA_TARGET_MEDIUM_HOURS`                     | server   | Medium target; default `72`.                           |
| `SLA_TARGET_LOW_HOURS`                        | server   | Low target; default `120`.                             |
| `STAFF_NAME`, `STAFF_EMAIL`, `STAFF_PASSWORD` | server   | Inputs for the one time staff bootstrap command only.  |
| `VITE_API_URL`                                | client   | API base URL, including `/api`.                        |

Cloudinary values belong only in `server/.env`, never in client source or `VITE_*` variables. With no Cloudinary configuration, JSON issue reporting works and photo uploads return a clear configuration error. `.env` files must not be committed.

## API overview

Protected endpoints use `Authorization: Bearer <token>`. Issue creation accepts JSON or `multipart/form-data` with an optional `image` field.

| Method   | Path                 | Access        | Purpose                                                  |
| -------- | -------------------- | ------------- | -------------------------------------------------------- |
| `GET`    | `/api/health`        | Public        | API health response.                                     |
| `POST`   | `/api/auth/register` | Public        | Register a student with `name`, `email`, and `password`. |
| `POST`   | `/api/auth/login`    | Public        | Authenticate with `email` and `password`.                |
| `GET`    | `/api/issues`        | Student/staff | List and filter reports; students see their own reports. |
| `POST`   | `/api/issues`        | Student/staff | Create a report, optionally with a photo.                |
| `GET`    | `/api/issues/stats`  | Student/staff | Return personal or global dashboard counts.              |
| `GET`    | `/api/issues/:id`    | Student/staff | Read a report subject to ownership.                      |
| `PATCH`  | `/api/issues/:id`    | Student/staff | Students edit own content; staff update workflow fields. |
| `DELETE` | `/api/issues/:id`    | Student/staff | Students delete own reports; staff can delete any.       |

List filters are `status`, `category`, `priority`, `search`, `page`, `limit` (up to 100), and `sort` (`newest`, `oldest`, `priority`). Issue status values are `open`, `in-progress`, `resolved`, and `closed`; priorities are `low`, `medium`, `high`, and `urgent`. List/create/read/update responses include server calculated `sla` data. Statistics retain the `{ total, byStatus, byCategory }` shape.

## Verification

From `client/`, run `npm run build` and `npm run lint`. From `server/`, run `npm test`. Backend tests use mocked models/providers for issue and upload route coverage; they do not prove live MongoDB persistence or contact Cloudinary. Use a configured MongoDB and Cloudinary account to verify provider credentials, stored data, and photo display end to end. No screenshots are currently included in this repository.

Automated tests cover health/not-found handling, registration role enforcement and login with mocked users, issue filtering and role scoping, SLA calculations, and upload validation/provider failures with mocked storage. They do not exercise browser logout, rendering, live MongoDB persistence, or real Cloudinary requests. For a manual submission pass, register/login a student, create a report with and without an attachment, exercise search and filters, then sign in as provisioned staff and update a report status. Also check logout and the layouts at mobile and desktop widths.

## Known limitations

- Authentication state is held in the browser tab's `sessionStorage` and expires with the JWT.
- There is no automated end to end browser test suite or bundled screenshot set.
- Image updates/removal after issue creation are not exposed in the current API.
- Real persistence and image provider behavior require the submitter's MongoDB and Cloudinary configuration.

## AI Development Experience

Code0 was used during CampusFix development. It assisted with these project tasks:

- Building and refining the Express API routes and JWT authentication flow, including public student registration and controlled staff provisioning.
- Implementing issue CRUD behavior with student ownership limits and staff workflow permissions.
- Debugging and testing issue filters, pagination, search, dashboard statistics, and SLA calculations.
- Refactoring the React interface into reusable page, layout, issue, and shared form components.
- Diagnosing the Cloudinary attachment flow and adding server-side file checks and mocked upload regression coverage.

I reviewed the generated changes and validated them with the production build, lint check, and backend automated tests. The automated route tests use mocked database and Cloudinary behavior; I have not completed a live database/provider run or a full manual browser test, so those workflows remain for final verification.

## AI Development Experience

Code0 was used as an AI-assisted development tool during the development of CampusFix. I reviewed its proposed changes, ran available tests, and checked the implementation rather than treating generated code as automatically correct.

### Tasks Assisted by Code0

1. **Backend API development:** Assisted with Express API structure, authentication, and issue-management routes.
2. **Authorization and security:** Assisted with role-based authorization and issue ownership checks.
3. **API testing:** Helped refine dashboard statistics, issue filtering, pagination, search, and automated tests.
4. **Frontend refactoring:** Assisted with organizing React components and improving the frontend user experience.
5. **Image upload debugging:** Helped troubleshoot and implement Cloudinary image uploads.

### Validation

Automated tests and manual verification were performed where possible. Database-dependent and external-service functionality should be considered verified only where it was tested against the actual service. Any remaining limitations are documented separately.
