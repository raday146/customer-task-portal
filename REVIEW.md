# REVIEW.md - Customer Task Portal production-readiness review

Branch: `review/fixes`. Every statement below was checked against the code, a live request, a test run or a browser session. Items I did not measure say so.

## 1. Executive summary

The app is multi-tenant, so the property that matters most is tenant isolation: one company must never read or change another company's data. It was broken on two endpoints. `GET /customers/:id` and `PATCH /tasks/:id` looked records up by id only, so any logged-in user could read or modify another tenant's customer or task if they knew the id. `PATCH /tasks/:id` also accepted `tenantId`, `customerId` and `assigneeId` from the request body with no validation, because `UpdateTaskDto` was a TypeScript type alias, so the global `ValidationPipe` never ran on it. Separately, a plain user could edit any task in their company, and a failed login wrote the submitted password to the logs.

I fixed four issues, each as a red test commit followed by a green fix commit. Remaining risks are in section 6.

Prioritisation: (a) breach of the stated access rule (README: data from other companies must never be visible or modifiable), (b) blast radius across tenants, (c) exploitable by any authenticated user with no tooling, then (d) integrity inside a tenant, (e) scalability and hygiene.

How I worked: ran the app locally on Node 20.19 with seeded data, read all of `apps/api/src`, the Prisma schema, `apps/api/test` and the web API client/form, probed each suspect with live requests, then fixed with TDD. Environment note: the repo requires Node >= 20 (`engines`), and `npm run db:seed` uses `node --env-file`, which fails on Node 18.8.

## 2. Findings, ranked

| # | Issue | Severity | Fixed? |
|---|-------|----------|--------|
| 1 | Cross-tenant read and write by id: `GET /customers/:id`, `PATCH /tasks/:id` | Critical | Yes |
| 2 | `PATCH /tasks/:id` unvalidated body: foreign `customerId`/`assigneeId` accepted, `tenantId`/`id` mass-assigned, `createdById`/`role` caused HTTP 500 | Critical | Yes |
| 3 | Any user could edit or complete any task in their company, and reassign tasks | High | Yes |
| 4 | Failed login logged the submitted password in plaintext | Medium | Yes |
| 5 | Remaining items in section 6 | Low-Medium | No |

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

Findings 1 and 2 break the README's non-negotiable rule, are exploitable by any authenticated user, and affect every tenant, so they came first. Finding 3 is a documented requirement and affects integrity inside a tenant. Finding 4 is a small, cheap fix with a clear confidentiality impact. Items in section 6 were left for the timebox.

## 4. Fixes

### Fix 1 - Tenant scoping (`d04a764`)
- **Change:** `CustomersService.findOne(tenantId, id)` uses `findFirst({ where: { id, tenantId } })`. `TasksService.update(user, id, changes)` looks the task up with the caller's `tenantId` first. Not found returns 404, not 403, so ids are not confirmed to exist.
- **Files:** `customers.controller.ts`, `customers.service.ts`, `tasks.controller.ts`, `tasks.service.ts`.
- **Trade-off:** each query remembers to pass `tenantId`. A Prisma extension or repository layer that injects it would be more robust but is a larger refactor.

### Fix 2 - Validate references and whitelist update payload (`2c03d51`)
- **Change:** `UpdateTaskDto` is now `class UpdateTaskDto extends PartialType(CreateTaskDto)` (`@nestjs/mapped-types`, already a dependency), so the existing global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) applies. `customerId` and `assigneeId` are checked against the caller's tenant by a private helper shared with `create()`; update returns 400 on failure. The Prisma data object is built field by field.
- **Trade-off:** up to two small lookups per write. `create()` keeps its existing response shape (see section 6).

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

Final results after all fixes (Node 20.19.0):

- `npm test`: API 5 suites, 40 tests passed (11 existing + 29 new); web 2 files, 4 tests passed.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0 (API `nest build`, web `tsc -b && vite build`).

### Manual check (browser, local)
Ran the API and web app locally and exercised the UI as `admin@northstar.test` and `maya@northstar.test`. The API ran on port 3100 because another process held 3000. A temporary vite config pointed the proxy there and was removed afterwards. I stubbed `window.confirm` in the page so the delete confirmation would not block the browser.

- **Admin:** dashboard loads. Create returned 201. Edit with assignee set to Unassigned and the due date cleared sent `assigneeId: null` and `dueDate: null` and returned 200. Complete sent `{"status":"DONE"}` and returned 200. Delete returned 204 and the row disappeared. Customer Previous/Next navigated to the neighbouring customers and back; Next is disabled on the last customer.
- **Maya (USER):** the Tasks page showed Edit/Complete only on her own tasks and no Delete button. Editing her own task sent the full form payload including her own `assigneeId` unchanged, and returned 200. Complete returned 200. Customer Previous/Next worked. From her session, API calls to PATCH Daniel's task, DELETE her own task and reassign her own task to Daniel returned 403.
- **Web form payload on PATCH** (`apps/web/src/components/TaskFormModal.tsx:48-53`): the form sends `title, description, customerId, assigneeId, status, dueDate`. "Unassigned" is `assigneeId: null`; an empty due date is `dueDate: null`; a set date is `YYYY-MM-DD`. All of these pass the new validation (`IsOptional` allows null; `IsUUID`, `IsEnum`, `IsDateString` accept the rest). The "Complete" buttons send only `{"status":"DONE"}`.

## 6. Remaining production risks (not fixed)

Verified:
- **Web form reassigns on edit** (`TaskFormModal.tsx:30`, `assigneeId: task?.assigneeId ?? user?.id`): opening Edit on an unassigned task and saving sends the editing user's id. I saw this happen in the browser: an unassigned task became assigned to the admin. Not caused by these changes, not fixed.
- **`POST /tasks` returns HTTP 201 with `{"success":false,"error":...}`** when a reference is invalid (`tasks.controller.ts:41-43`). Clients that check only the status see success. The web client handles it explicitly. Left as is.
- **Past due date accepted on PATCH:** `create()` rejects past dates (`tasks.service.ts:55`), `update()` does not (PATCH with 2020-01-01 returned 200). This also lets overdue tasks be edited from the UI, so it may be intentional.
- **No login rate limiting:** 15 consecutive wrong-password logins all returned 401.
- **Token stored in `localStorage`** (`apps/web/src/api/client.ts:14-29`).
- **Dashboard N+1:** `dashboard.service.ts:41-45` runs one task query per customer and filters in memory. I did not run `seed:large` or measure latency.
- **Missing indexes:** `Task` has only `@@index([tenantId, status])` (`schema.prisma:78`); nothing on `customerId`, `assigneeId` or `dueDate`.
- **Overdue logic:** `dashboard.service.ts:48` compares `dueDate < now` in UTC, so a date-only value counts as overdue after UTC midnight.
- **`null` for `title`, `status` or `customerId` on PATCH** passes validation (`IsOptional` skips null) and is ignored by the service.

From code reading, not measured:
- Login skips bcrypt when the email does not exist (`auth.service.ts:28`), so response time may reveal registered emails. The error message itself is identical.

Checked and not an issue:
- Pagination is capped (`pageSize` max 100; `pageSize=100000` returns 400).
- No raw SQL under `apps/api/src`.
- The JWT secret has no code default (`getOrThrow`).
- List endpoints and dashboard totals are scoped by tenant.
- Error responses did not include stack traces.
- Status values are validated as enums.

General: tenant scoping relies on each query passing `tenantId`. A future query that forgets it reintroduces finding 1. There is no database-level isolation.

## 7. AI usage

I used Claude Code to read the code, probe the endpoints, write the failing tests and implement the fixes. Findings 1-4 each have a red commit before the fix commit, and the Phase 0 report was corrected once during testing: mass assignment on PATCH, first marked not present, was confirmed by the red test run.
