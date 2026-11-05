# REVIEW.md - Customer Task Portal production-readiness review

Branches: `review/fixes` and `review/polish`. Every statement below was checked against the code, a live request, a test run or a browser session. Items I did not measure say so.

## 1. Executive summary

The app is multi-tenant, so the property that matters most is tenant isolation: one company must never read or change another company's data. It was broken on two endpoints. `GET /customers/:id` and `PATCH /tasks/:id` looked records up by id only, so any logged-in user could read or modify another tenant's customer or task if they knew the id. `PATCH /tasks/:id` also accepted `tenantId`, `customerId` and `assigneeId` from the request body with no validation, because `UpdateTaskDto` was a TypeScript type alias, so the global `ValidationPipe` never ran on it. Separately, a plain user could edit any task in their company, and a failed login wrote the submitted password to the logs.

The top three findings plus the password-in-logs fix are on `review/fixes`. The smaller items (edit-form assignee, create error response, past due date on PATCH, dashboard N+1 and indexes, login limiter and dummy bcrypt compare) are on `review/polish`. Each is a test commit followed by a fix commit, except the indexes (see the follow-up section). Remaining risks are in section 6.

Prioritisation: (a) breach of the stated access rule (README: data from other companies must never be visible or modifiable), (b) blast radius across tenants, (c) exploitable by any authenticated user with no tooling, then (d) integrity inside a tenant, (e) scalability and hygiene.

How I worked: ran the app locally on Node 20.19 with seeded data, read all of `apps/api/src`, the Prisma schema, `apps/api/test` and the web API client/form, probed each suspect with live requests, then fixed with TDD. Environment note: the repo requires Node >= 20 (`engines`), and `npm run db:seed` uses `node --env-file`, which fails on Node 18.8.

## 2. Findings, ranked

| # | Issue | Severity | Business impact | Fixed? |
|---|-------|----------|-----------------|--------|
| 1 | Cross-tenant read and write by id (`GET /customers/:id`, `PATCH /tasks/:id`) | Critical | Confidentiality breach across every customer company; contractual and regulatory exposure | Yes |
| 2 | Unvalidated PATCH body (foreign references, `tenantId` mass assignment, HTTP 500s) | Critical | Corrupts tenant data and leaks data through joins; trivially exploitable | Yes |
| 3 | Any user can edit or reassign any task in their company | High | Breaks the documented role model; anyone can tamper with others' work | Yes |
| 4 | Failed login logs the plaintext password | Medium | Credentials end up in log storage and with anyone who can read logs | Yes |
| 5 | Dashboard N+1 queries, missing indexes, UTC overdue logic (see follow-up fixes and section 6) | Medium | Slow pages as data grows; wrong overdue counts | Partly - N+1 and indexes fixed; UTC overdue logic not |
| 6 | No login rate limiting, possible login timing leak (from code reading), token in localStorage (see follow-up fixes and section 6) | Medium | Brute force and email enumeration are easy; XSS becomes account takeover | Partly - rate limit and timing fixed; localStorage not |
| 7 | Web edit form silently assigns unassigned tasks to the editor; create returns 201 with success:false (see follow-up fixes) | Low-Medium | Silent data changes and client-side confusion | Yes |

### Finding 1 - Cross-tenant read/write by id
- **Where (before fix):** `apps/api/src/customers/customers.service.ts:45-52` (`findUnique({ where: { id } })`), `apps/api/src/tasks/tasks.service.ts:73-75` (same for update); controllers did not pass the tenant (`customers.controller.ts:20`, `tasks.controller.ts:49`).
- **Reproduce (before fix):** as `admin@northstar.test`, `GET /api/customers/<Bluebird customer id>` returned 200 with the Bluebird customer. `PATCH /api/tasks/<Bluebird task id>` with `{"title":"PWNED-by-northstar"}` returned 200 and the DB row changed. The previous/next neighbours were computed from the foreign customer's name.
- **Not vulnerable (verified):** `GET /customers/:id/tasks` and `DELETE /tasks/:id` were already scoped by tenant.
- **Why it matters:** contractual and confidentiality breach across all tenants.

### Finding 2 - Unvalidated PATCH body
- **Where (before fix):** `apps/api/src/tasks/dto/update-task.dto.ts:3` (`export type UpdateTaskDto = Partial<CreateTaskDto>`, a type, not a class) and `tasks.service.ts:77-84` (`...changes` spread into `prisma.task.update`, no customer/assignee check).
- **Reproduce (before fix):** a PATCH to a Northstar task with a Bluebird `customerId` and `assigneeId` returned 200, and the DB showed the task's tenant differed from its customer's and assignee's tenant. In the red test run, `tenantId` and `id` in the body returned 200, and `createdById` and `role` returned 500.
- **Create path:** `POST /tasks` was already validated and rejects foreign references and extra fields (400).

### Finding 3 - Missing ownership enforcement
- **Where (before fix):** `apps/api/src/tasks/tasks.controller.ts:48-51` (no `@CurrentUser`, no ownership check).
- **Reproduce (before fix):** `maya@northstar.test` (role USER) PATCHed a task assigned to Daniel and got 200.
- **Not vulnerable (verified):** `DELETE` was already admin-only (`@Roles('ADMIN')`), and a user got 403.

### Finding 4 - Password in logs
- **Where (before fix):** `apps/api/src/auth/auth.service.ts:30`, `JSON.stringify(dto)` on failed login. A failed login with a test password produced `Login failed: {"email":...,"password":"..."}` in the API log.

## 3. Prioritisation rationale

Findings 1 and 2 break the README's non-negotiable rule, are exploitable by any authenticated user, and affect every tenant, so they came first. Finding 3 is a documented requirement and affects integrity inside a tenant. Finding 4 is a small, cheap fix with a clear confidentiality impact. The remaining items were done afterwards on `review/polish` where safe. What is left (localStorage token, UTC overdue logic and the others in section 6) was deliberately left, with reasons in section 6. Order is severity first, then ease of exploitation.

## 4. Fixes

### Fix 1 - Tenant scoping (`d04a764`)
- **Change:** `CustomersService.findOne(tenantId, id)` uses `findFirst({ where: { id, tenantId } })`. `TasksService.update(user, id, changes)` looks the task up with the caller's `tenantId` first. Not found returns 404, not 403, so ids are not confirmed to exist.
- **Files:** `customers.controller.ts`, `customers.service.ts`, `tasks.controller.ts`, `tasks.service.ts`.
- **Trade-off:** each query remembers to pass `tenantId`. A Prisma extension or repository layer that injects it would be more robust but is a larger refactor.

### Fix 2 - Validate references and whitelist update payload (`2c03d51`)
- **Change:** `UpdateTaskDto` is now `class UpdateTaskDto extends PartialType(CreateTaskDto)` (`@nestjs/mapped-types`, already a dependency), so the existing global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) applies. `customerId` and `assigneeId` are checked against the caller's tenant by a private helper shared with `create()`; update returns 400 on failure. The Prisma data object is built field by field.
- **Trade-off:** up to two small lookups per write. `create()` originally returned 201 with success:false; that was changed afterwards, see follow-up (b).

### Fix 3 - Ownership rule (`134a8d4`)
- **Change:** after the tenant lookup (404), a non-admin gets 403 unless `task.assigneeId === user.id`, and also gets 403 if the request changes `assigneeId` to a different value. The same value sent back unchanged is allowed. Admins may update any task in their tenant. Delete stays admin-only.
- **Trade-off:** the rule lives in the service. A user who owns a task can still change its other fields, including `customerId` and `dueDate`, because the requirement did not restrict them.

### Fix 4 - Stop logging the password (`bde9f87`)
- **Change:** the warning now logs only the email: `Login failed for <email>`.

Commit history for these fixes (each fix preceded by its red test commit):

```
bde9f87 fix: stop logging submitted password on failed login
193acf5 test: failing test for password leaking into logs
d073637 chore: format e2e test helpers
134a8d4 fix: enforce assignee-only updates for non-admin users
7411432 test: failing tests for task permissions
2c03d51 fix: validate task references and whitelist update payload
8bec6c6 test: failing tests for cross-tenant references and mass assignment
d04a764 fix: scope customer detail and task update lookups to caller tenant
5dfd0e9 test: failing tests for tenant isolation
```

## 5. Tests

New e2e tests create their own tenants, users, customers and tasks (`apps/api/test/helpers.ts`) and delete them afterwards. They do not depend on or alter seeded rows. They need the local Postgres and `npm run db:migrate`.

| Test file | Cases | Red run (before fix) |
|-----------|-------|----------------------|
| `apps/api/test/tenant-isolation.e2e-spec.ts` | 6: cross-tenant customer GET, customer tasks, task PATCH and DELETE; same-tenant GET, PATCH, DELETE still work | 2 failed: foreign customer GET returned 200 (expected 404), foreign task PATCH returned 200 (expected 404). 4 passed: same-tenant paths, plus `/customers/:id/tasks` and `DELETE`, which were already safe |
| `apps/api/test/cross-tenant-references.e2e-spec.ts` | 14: PATCH and POST with foreign `customerId`/`assigneeId`, extra body fields, same-tenant and null assignee still accepted | 6 failed, all PATCH: foreign `customerId` and `assigneeId` returned 200; `tenantId` and `id` in the body returned 200; `createdById` and `role` returned 500. 8 passed, including all POST cases |
| `apps/api/test/task-permissions.e2e-spec.ts` | 8: user edits own task, unchanged `assigneeId` accepted, foreign-assigned and unassigned tasks 403, reassign 403, delete 403, cross-tenant 404 before 403, admin can edit, assign and delete | 3 failed with 200 where 403 expected (edit someone else's task, complete an unassigned task, reassign own task). 5 passed: allowed paths and guards that already worked |
| `apps/api/src/auth/auth.service.spec.ts` (new case) | logger-spy: failed login must not log the submitted password | Failed: the captured warning contained the password |

Final results after all fixes (Node 20.19 and 22):

- `npm test`: API 10 suites, 59 tests passed; web 3 files, 8 tests passed (fresh run after the follow-up fixes).
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 (API `nest build`, web `tsc -b && vite build`).

### Manual check (browser, local)
Ran the API and web app locally and exercised the UI as `admin@northstar.test` and `maya@northstar.test`. The API ran on port 3100 because another process held 3000. A temporary vite config pointed the proxy there and was removed afterwards. I stubbed `window.confirm` in the page so the delete confirmation would not block the browser.

- **Admin:** dashboard loads. Create returned 201. Edit with assignee set to Unassigned and the due date cleared sent `assigneeId: null` and `dueDate: null` and returned 200. Complete sent `{"status":"DONE"}` and returned 200. Delete returned 204 and the row disappeared. Customer Previous/Next navigated to the neighbouring customers and back; Next is disabled on the last customer.
- **Maya (USER):** the Tasks page showed Edit/Complete only on her own tasks and no Delete button. Editing her own task sent the full form payload including her own `assigneeId` unchanged, and returned 200. Complete returned 200. Customer Previous/Next worked. From her session, API calls to PATCH Daniel's task, DELETE her own task and reassign her own task to Daniel returned 403.
- **Web form payload on PATCH** (`apps/web/src/components/TaskFormModal.tsx:48-53`): the form sends `title, description, customerId, assigneeId, status, dueDate`. "Unassigned" is `assigneeId: null`; an empty due date is `dueDate: null`; a set date is `YYYY-MM-DD`. All of these pass the new validation (`IsOptional` allows null; `IsUUID`, `IsEnum`, `IsDateString` accept the rest). The "Complete" buttons send only `{"status":"DONE"}`.

This browser check was done on `review/fixes`. The follow-up fixes on `review/polish` are covered by automated tests.

## Follow-up fixes (branch review/polish)

`review/polish` is branched from `review/fixes`, which is already merged into `main` through PR #1. `main` is the core three-fix submission; `review/polish` adds the smaller follow-up fixes.

New tests on this branch:
- `apps/web/src/components/TaskFormModal.test.tsx`
- `apps/api/test/dashboard.e2e-spec.ts`
- `apps/api/test/dashboard-queries.e2e-spec.ts`
- `apps/api/test/login-rate-limit.e2e-spec.ts`
- `apps/api/test/task-create-errors.e2e-spec.ts`
- `apps/api/test/task-update-due-date.e2e-spec.ts`
- `apps/api/src/auth/auth.service.spec.ts` (new bcrypt spy case: `bcrypt.compare` runs for unknown emails)

Items (a)-(d) and (f) are a red test commit followed by a fix commit; (e) is a single schema/migration commit.

### (a) Edit form no longer assigns the editor on edit (`95a9fe7`, `87ec666`)
- The form defaults `assigneeId` to the current user only when creating. Editing an unassigned task keeps it unassigned.

### (b) Create returns 400 instead of 201 with success:false (`fa3718f`, `1202f3e`, `97924dd`)
- A rejected `POST /tasks` now returns 400 with the standard error shape. This is an intentional API contract change. The web client's `success:false` handling was removed, the error path is tested, and no existing tests were changed.

### (c) PATCH rejects a changed past due date (`9e48e2b`, `74a0d39`)
- A changed past `dueDate` returns 400. Unchanged overdue dates, null, and today/future dates are allowed.

### (d) Dashboard query rewrite (`929c74b`, `73b4d70`)
- On `seed:large`: before 1,516 SQL queries and median 0.974 s; after 7 queries and median 0.023 s. Query counts came from a script calling the service; latency from 5 curl runs, same method before and after.
- One behaviour change: upcoming tasks with equal due dates are now ordered by id.

### (e) Task indexes (`bc24f14`, migration `add_task_indexes`)
- Three indexes: tenant+assignee, tenant+customer, tenant+dueDate. At ~6,100 rows EXPLAIN still shows a sequential scan. The speedup in (d) comes from the query rewrite, not the indexes. The indexes are for growth and selective filters and were not shown to help at this size.

### (f) Failed-login limiter and timing (`217a034`, `bb00bcb`, `00173f9`, `6e95970`)
- 5 failed attempts per 15 minutes, keyed by ip+email, returns 429. Only failed attempts count. Unknown emails are treated like known ones. Config: `LOGIN_MAX_ATTEMPTS` and `LOGIN_WINDOW_MS`.
- Login now runs a dummy `bcrypt.compare` for unknown emails, so the bcrypt step no longer depends on whether the email exists.

## 6. Remaining production risks (after the follow-up fixes)

Verified:
- **Token stored in `localStorage`** (`apps/web/src/api/client.ts:14-29`). Moving to httpOnly cookies needs CORS credentials, CSRF protection, a logout endpoint and web changes, which is a larger auth redesign than this timebox.
- **Overdue logic:** `dashboard.service.ts` compares `dueDate < now` in UTC, so a date-only value counts as overdue after UTC midnight.
- **`null` for `title`, `status` or `customerId` on PATCH** passes validation (`IsOptional` skips null) and is ignored by the service.
- **Login limiter limitations:** single-instance in-memory store (not shared across instances or restarts); fixed window, not sliding; no size cap on the map within the window; needs `trust proxy` behind a proxy or all clients share the proxy IP; users behind one shared IP (NAT) share the failed-attempt budget for the same email.

Checked and not an issue:
- Pagination is capped (`pageSize` max 100; `pageSize=100000` returns 400).
- No raw SQL under `apps/api/src`.
- The JWT secret has no code default (`getOrThrow`).
- List endpoints and dashboard totals are scoped by tenant.
- Error responses did not include stack traces.
- Status values are validated as enums.

General: tenant scoping relies on each query passing `tenantId`. A future query that forgets it reintroduces finding 1. There is no database-level isolation.

### If I had another day

1. Make tenant scoping structural with a Prisma extension or scoped repository that injects `tenantId`, then add Postgres row-level security as defence in depth.
2. Shared-store rate limiting (for example Redis) plus httpOnly cookies or short-lived tokens.
3. Check the new indexes with EXPLAIN on selective queries (assigneeId, customerId) and at a larger data size.

## 7. AI usage

I chose the top three from the README's access rules. I used Claude (chat for analysis and planning, Claude Code for probing, writing tests and implementing fixes). I reviewed each diff and the test and browser-check results. An early AI assessment wrongly marked PATCH mass assignment as not present, and the red test run corrected it. The follow-up fixes on `review/polish` were also done with TDD and reviewed by me.
