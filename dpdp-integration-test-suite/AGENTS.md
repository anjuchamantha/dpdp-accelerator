# DPDP Integration Test Suite — Agent Guide

Instructions for writing tests in this directory. Read this before adding or changing a spec or
page object.

## The one thing that shapes everything

These tests drive a **real, already-running WSO2 Identity Server** with the DPDP accelerator
deployed, through real OAuth2 logins, against a real consent database. Nothing is mocked, stubbed,
or reset. Data from every previous run is still there and will still be there after yours.

This suite does not start the server. If `PORTAL_BASE_URL` / `IS_BASE_URL` aren't up, `global-setup.ts`
fails fast with a reachability error — that's the environment, not your test.

## Running

```sh
npx playwright test                      # everything, parallel
npx playwright test tests/03-consents    # one category
npx playwright test --workers=1          # serial; use this to distinguish a real failure from a flake
npx tsc --noEmit                         # REQUIRED before you call a change done — see below
npm run report                           # open the last HTML report
```

`./run-e2e.sh` wraps the above and installs Chromium on first use. Any Playwright flag passes
through, including `--ui`.

**`npx tsc --noEmit` is not optional.** Playwright transpiles each file with esbuild and never
typechecks, so a missing import or a renamed method fails at *runtime* — and because Playwright
aborts collection when any file fails to load, one bad import reports as `0 tests in 0 files`
across the whole suite, not as one broken spec. This has already happened once here.

## Layout

| Path | What belongs there |
| --- | --- |
| `tests/<nn>-<area>/` | Specs, grouped by feature area |
| `pages/` | Page Objects — one class per screen or dialog; all locators live here, never in a spec |
| `clients/ConsentApiClient.ts` | Typed wrapper over the IS consent REST APIs |
| `fixtures/auth.fixtures.ts` | Personas, API-client fixtures, cleanup tracker. Re-exports `test`/`expect` |
| `fixtures/tenant.fixtures.ts` | `tests/05-multi-tenancy/` only — see "Multi-tenancy" below |
| `utils/` | Env/config, auth headers, unique test-data generators, MUI helpers |

Import `test` and `expect` **from `../../fixtures/auth.fixtures`**, never from `@playwright/test`
directly — the fixtures are only available on the extended `test`. `tests/05-multi-tenancy/`
imports from `../../fixtures/tenant.fixtures` instead, which itself extends `auth.fixtures`'s
`test` (so `consentAdminConsentApi` etc. are still available there too).

### Test IDs are not directory numbers

The directory prefix and the test-ID prefix are deliberately different, because IDs come from the
team's external test-scenario spreadsheet and directories are just execution grouping:

| Directory | Test IDs |
| --- | --- |
| `01-elements/` | `03.xx.xx` |
| `02-purposes/` | `04.xx.xx` |
| `03-consents/` | `02.xx.xx` |
| `04-authorization/` | `01.xx.xx` |

Do not "fix" this to line up. Keep a new test's ID consistent with the spreadsheet, and name the
test `'<id> - <plain description of the observable behaviour>'`.

## Personas and auth

```ts
const page = await loginAsUser(browser)          // any signed-in user; manages only their own consents
const page = await loginAsConsentAdmin(browser)  // holds dpdp-consent-admin; every internal_consent_mgt_* scope
```

Both take the worker-scoped `browser` fixture and return an already-signed-in `Page`. **You own the
returned page's context and must close it**: `await page.context().close()` at the end of the test.
Leaking contexts is the fastest way to make the suite flaky.

A persona logs in for real at most **once per run**, cached to `.auth/<persona>.json` and shared
across workers. Do not add your own login flow, and do not call `getPersonaState` unless you need a
persona with no fixture (only `user-2` qualifies).

A second user account is optional. Tests needing two distinct real users must guard themselves:

```ts
test.skip(!hasSecondUser(), 'TEST_USER_2_USERNAME/PASSWORD is not configured')
```

### API access

Three fixtures, requested by destructuring the test callback's first argument:

```ts
test('...', async ({ browser, consentAdminConsentApi, consentCleanupTracker }) => { ... })
```

- `userConsentApi` — `ConsentApiClient` bound to the user's headers (self-service surface).
- `consentAdminConsentApi` — bound to the admin's headers (admin surface).
- `consentCleanupTracker` — register created records for teardown (below).

To prove a scope boundary, construct `ConsentApiClient` yourself with the *wrong* persona's headers
and call an admin method — that's the intended way to assert a user's token is rejected.

## Multi-tenancy (`tests/05-multi-tenancy/`)

```ts
const page = await loginAsTenantOwner(browser, tenant)        // holds every internal_consent_mgt_* scope
const page = await loginAsTenantConsentUser(browser, tenant)   // holds dpdp-consent-user (no permissions)
```

`tenant` (worker-scoped, from `fixtures/tenant.fixtures.ts`) creates one throwaway tenant per
worker — a unique domain every run, an owner, and a second `dpdp-consent-user` account with its
role already assigned — entirely by driving the real Console UI in a browser, the same way an
actual admin would. There's no teardown call: a fresh domain every run means nothing to collide
with, and there's no real tenant delete on this product without enabling a `carbon.xml` flag this
accelerator doesn't set.

**Do not add a `TenantScimClient` or call SCIM2 against a secondary tenant directly.** Confirmed
live, repeatedly: Basic-auth and Bearer-token SCIM2 calls against `/t/<tenant>/scim2/...` both
401 for any tenant other than `carbon.super`, regardless of whose credentials — a real IS 7.3.0
product limitation (see the WSO2 IAM community discussion "Invalid tenant domain of user error
when use scim2 API"), not something fixable from this codebase. The one thing that *does* work is
driving the same operations through Console's own UI (its frontend authenticates its internal
calls some other way a standalone `Authorization` header replay doesn't reproduce) — that's why
tenant creation, second-user creation, and role assignment are all done via `ConsoleRootOrganizationWizard`,
`ConsoleAddUserWizard`, and `ConsoleRoleAssignment` in `pages/`, never via a REST client. If you need
a new tenant-side Console operation this suite doesn't have yet, add another page object in that
style rather than reaching for SCIM2.

Also note: tenant creation itself has no REST-API shortcut worth using either — `POST
/api/server/v1/tenants`'s `owners[].password` field doesn't actually become usable for login until
a separate follow-up call, while Console's own "New Root Organization" form's password field works
immediately. `ConsoleRootOrganizationWizard` is the only tenant-creation path this suite uses.

## Non-negotiable rules for writing a test

**Stamp every record you create, and assert by that marker or by the server-issued ID.** Use
`uniqueMarker`, `uniquePurposeName`, `uniqueElementName`, `uniqueServiceId`, or the realistic
`randomElementProfile` / `randomPurposeProfile` / `randomServiceId` from `utils/testData.ts`.

**Never assert on emptiness, totals, or row counts of a shared list.** `expect(rows).toHaveCount(1)`
and "the list is empty" are always wrong here — a concurrent test or a previous run will break them.
Assert that *your* row is present (or absent) by its id.

**Track what you create.** `consentCleanupTracker.trackElement(id)` / `.trackPurpose(id)` deletes
them when the test finishes. Read the id out of the detail URL after a create-form redirect:

```ts
await expect(page).toHaveURL(/\/elements\/[^/]+$/)
const id = /\/elements\/([^/]+)$/.exec(page.url())?.[1]
```

**Consents cannot be cleaned up** — the product has no delete-by-id for them, so every seeded
consent is permanent. Seed the minimum you need. (The shared environment already carries dozens.)

**Assume parallel execution.** `fullyParallel: true` and no `workers` override. Your test must not
depend on ordering, on another test's data, or on being alone. If you genuinely need ordered steps,
use `test.describe.serial` and say why in a comment.

**Use `seedConsent` (`utils/consentSetup.ts`)** rather than hand-rolling setup. Consent creation is
the only step with no create UI, so it goes through the admin API; the Element and Purpose it needs
are created through the real admin forms. Note `state: 'PENDING'` is expressed by supplying
`authorizations` — the v2 API sets PENDING itself and rejects an explicit `PENDING`.

## Page objects

**All locators live in `pages/`.** A spec that contains `getByRole`/`getByText` is doing the page
object's job.

**Source every user-facing string from the frontend's i18n, not from memory or from the rendered
page.** The single largest category of breakage in this suite has been locators drifting from
renamed copy. Before writing a locator, find the key:

```sh
grep -rn "someKey" ../dpdp-accelerator/react-apps/consent-portal/frontend/public/i18n/en/common.json
```

Then confirm which key the component actually renders. Two traps that have already cost real time:

- `sidebar.allConsents` is **"My Consents"** (the user's own list); **"All Consents"** is
  `sidebar.adminConsents`, the *admin* registry. A user-persona test asserting "All Consents" is
  asserting the opposite of what it reads like.
- `catalog.messages.noElements` is "No elements are configured for this **version**", while
  `consentRegistry.details.noElements` is "No elements are **associated** with this purpose" — near
  identical strings, different pages.

Also note the elements and purposes lists have **different** search placeholders ("Search by element
name" / "Search by purpose name"), so no shared "Search by name" locator can match either.
`getByPlaceholder` matches on substring, which makes a wrong guess here look plausible.

**Never use a leading slash in `goto()`.** Playwright resolves a leading-slash path against
`baseURL` by *replacing* its path, so `goto('/consents')` leaves the portal entirely and
`goto('/')` lands on the Identity Server root (which redirects to the Console). Always
`page.goto('consents')`, and `'./'` for the portal root. `utils/env.ts` documents why `baseURL`
carries a trailing slash; don't remove it.

**Registry rows are addressed by `data-consent-id`**, via `ConsentRegistryTable.rowByConsentId`.
Both registries extend that base class — put anything shared between them there, not in one subclass.

**MUI `<Select>` is not a native `<select>`.** Use `selectMuiOption(page, id, optionName)` from
`utils/muiSelect.ts`; `selectOption()` will not work. The open menu portals to `<body>`, outside any
dialog, which is why the helper looks options up on the page.

**Sidebar absence means "not in the DOM".** `AppSidebar.tsx` filters items the persona lacks the
scope for out entirely, and drops a whole category once no item in it survives — so assert
`toHaveCount(0)`, not `not.toBeVisible()`. Route guards behave differently: an unauthorized route
*redirects* (to the dashboard, or renders `NoAccessPage`), so assert on the resulting URL.

**Admin-scoped personas lose the self-service nav.** `deployment.config.json` ships
`hideSelfConsentsForAdmins: true`, so an account with `CONSENTS_READ_ANY` has no "My Consents" and
no "Consent" category at all. Don't assume the admin sees a superset of what the user sees.

## Auth-fixture internals you must not undo

Two non-obvious lines in `pageForPersonaState` are load-bearing for parallel runs. Both have long
comments; read them before touching that function.

1. **`JSESSIONID` is filtered out of the reused `storageState`.** The portal's JSP shell parks the
   authorization code in the servlet HTTP session and hands it over exactly once. Sharing one
   `JSESSIONID` across contexts means concurrent callbacks stomp a single parked code. `commonAuthId`
   is deliberately kept so sign-in stays silent.
2. **The Bearer-request watcher is armed before navigating, not after.** A reused session signs in
   during the `goto`, so a watcher started afterwards waits 30 s for a request already made.

## Known flakiness

The suite is **not** fully deterministic. Measured over 12 consecutive parallel runs: 9 clean, 2
with a single failure, 1 with 18. Two open modes:

- A deep-linked `goto()` occasionally lands on `/dashboard` instead of the requested route, so the
  test times out waiting for an element on a page that never rendered. Not slowness — extra waiting
  does not help.
- One run failed 18 tests with `401` on API seeding using the cached admin token. Unreproduced and
  unexplained.

## Before you call a change done

1. `npx tsc --noEmit` — clean.
2. `npx playwright test <your specs> --workers=1` — passing.
3. `npx playwright test` — full suite, parallel, and compare against the flake profile above.
4. State actual counts. "Tests pass" without the numbers is not a result.
