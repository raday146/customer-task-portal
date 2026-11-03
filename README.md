# Customer Task Portal

A small multi-tenant B2B SaaS application for managing customers and the follow-up work around them.
Each company (tenant) has its own users, customers and tasks.

- **Frontend:** React 18, TypeScript, Vite, React Router (`apps/web`)
- **Backend:** NestJS 10 on Express, Prisma ORM, JWT auth (`apps/api`)
- **Database:** PostgreSQL 16 via Docker Compose

> This is a local demo / evaluation project. It is not production software and contains only fictional data.

## Prerequisites

- Node.js 20+ and npm 10+
- Docker (for PostgreSQL)

## Getting started

```bash
npm install            # installs both workspaces and generates the Prisma client
npm run setup          # creates apps/api/.env from .env.example
docker compose up -d   # starts PostgreSQL on localhost:5433
npm run db:migrate     # applies Prisma migrations
npm run db:seed        # loads demo tenants, users, customers and tasks
npm run dev            # API on http://localhost:3000/api, web on http://localhost:5173
```

Open http://localhost:5173 and sign in with one of the demo accounts.

### Demo accounts (local only)

All demo accounts use the password **`DemoPass123!`**. These credentials exist only in the local seed.

| Company              | Email                   | Role  |
| -------------------- | ----------------------- | ----- |
| Northstar Consulting | `admin@northstar.test`  | Admin |
| Northstar Consulting | `maya@northstar.test`   | User  |
| Northstar Consulting | `daniel@northstar.test` | User  |
| Bluebird Logistics   | `admin@bluebird.test`   | Admin |
| Bluebird Logistics   | `priya@bluebird.test`   | User  |
| Bluebird Logistics   | `tom@bluebird.test`     | User  |

### Useful scripts

| Command              | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `npm run dev`        | Run API (watch mode) and web app together                           |
| `npm test`           | Run API tests (Jest + Supertest) and web tests (Vitest + RTL)       |
| `npm run build`      | Production build of both apps                                       |
| `npm run lint`       | ESLint for both apps                                                |
| `npm run typecheck`  | TypeScript checks for both apps                                     |
| `npm run db:seed`    | Reset the database to the standard demo data                        |
| `npm run seed:large` | Add ~1,500 customers / 6,000 tasks to Northstar (run after db:seed) |
| `npm run db:reset`   | Drop, re-migrate and re-seed the database                           |

The API tests include end-to-end tests that run against the seeded local database, so make sure
PostgreSQL is running and `npm run db:seed` has been executed before `npm test`.

## Product overview

### Features

- **Sign in / sign out** with email and password. The sidebar shows the signed-in user's name, role and company.
- **Dashboard:** customer count, open, completed and overdue tasks, upcoming work and the customers with the most open tasks.
- **Customers:** searchable (name or email), filterable by status, paginated list.
- **Customer detail:** customer information, previous/next navigation, and the customer's tasks.
- **Tasks:** list with status and assignee filters; create, edit, assign, complete and (admins) delete tasks.

### Access rules

- Users belong to exactly one company. Everything a user sees and changes — customers, tasks, team members,
  dashboard figures — must belong to their own company. Data from other companies must never be visible or
  modifiable, even if a record ID is known.
- **Admins** can create, edit, assign, complete and delete any task in their company.
- **Users** can create tasks, and can edit or complete tasks that are assigned to them. They cannot delete tasks.
- Tasks can only reference customers and assignees from the same company.
- Ownership information (company, role) comes from the authenticated session, never from request input.

### API

All endpoints are under `/api` and, except login, require `Authorization: Bearer <token>`.

| Method | Path                   | Description                                 |
| ------ | ---------------------- | ------------------------------------------- |
| POST   | `/auth/login`          | Exchange email/password for an access token |
| GET    | `/auth/me`             | Current user profile                        |
| GET    | `/dashboard`           | Dashboard metrics                           |
| GET    | `/users`               | Team members of the current company         |
| GET    | `/customers`           | `?search=&status=&page=&pageSize=`          |
| GET    | `/customers/:id`       | Customer detail                             |
| GET    | `/customers/:id/tasks` | Tasks for a customer                        |
| GET    | `/tasks`               | `?status=&assigneeId=&page=&pageSize=`      |
| POST   | `/tasks`               | Create a task                               |
| PATCH  | `/tasks/:id`           | Update a task                               |
| DELETE | `/tasks/:id`           | Delete a task (admin)                       |

Errors use the shape `{ statusCode, error, message, path, timestamp }`.

## Project structure

```text
apps/
  api/
    prisma/            schema, migrations, seed scripts
    src/
      auth/            login, JWT guard
      common/          decorators, roles guard, exception filter, request logging
      customers/       customers module
      dashboard/       dashboard metrics
      tasks/           tasks module
      users/           team members
      prisma/          PrismaService
    test/              e2e tests
  web/
    src/
      api/             fetch client and types
      auth/            auth context and route guard
      components/      layout, tables, form modal, toasts
      hooks/           data-fetching hooks
      pages/           route components
```

## Troubleshooting

- **Port 5433 in use:** change the host port in `docker-compose.yml` and `DATABASE_URL` in `apps/api/.env`.
- **`Can't reach database server`:** make sure `docker compose up -d` has finished (`docker compose ps` shows healthy).
- **Signed out unexpectedly:** access tokens expire after 8 hours by default (`JWT_EXPIRES_IN`).
