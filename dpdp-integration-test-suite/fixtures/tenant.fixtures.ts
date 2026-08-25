/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { type Browser, type Page, type Request, request as playwrightRequest } from '@playwright/test'
import { ConsentApiClient } from '../clients/ConsentApiClient'
import { ConsoleAddUserWizard } from '../pages/ConsoleAddUserWizard'
import { ConsoleRoleAssignment } from '../pages/ConsoleRoleAssignment'
import { ConsoleRootOrganizationWizard } from '../pages/ConsoleRootOrganizationWizard'
import { LoginPage } from '../pages/LoginPage'
import { authHeadersFromPersonaState, type PersonaAuthState } from '../utils/authStorage'
import { consoleRootOrganizationsUrl, env, tenantConsoleUrl, tenantPortalUrl, type Persona } from '../utils/env'
import { uniqueMarker, uniqueTenantDomain } from '../utils/testData'
// Extends auth.fixtures's own `test`, not raw @playwright/test - tests/05-multi-tenancy needs
// the super tenant's consentAdminConsentApi fixture too (for the isolation scenario, which
// compares a tenant-scoped Purpose against a super-tenant one), and Playwright fixtures only
// compose by extending, not by importing two independently-extended `test` objects into one spec.
import { test as base } from './auth.fixtures'

/**
 * Everything tests/05-multi-tenancy needs about the one throwaway tenant this worker created:
 * its domain, its two personas (see the `tenant` fixture below for what each is for), and a
 * ready-made API client bound to the owner's auth, tenant-qualified.
 */
export interface TenantContext {
  domain: string
  /** Created via Console's "New Root Organization" wizard, then explicitly assigned
   * dpdp-consent-admin by this fixture - role membership is never auto-provisioned, being the
   * tenant's owner grants Console/IS-level administration only, nothing about this custom
   * application role (confirmed live: without the explicit assignment below, the owner's sidebar
   * has no admin items at all). */
  owner: Persona
  /** Created via the owner's own Console "Add User" wizard and assigned dpdp-consent-user
   * (no permissions) - the tenant-local equivalent of the super tenant's plain `user` persona. */
  consentUser: Persona
  ownerConsentApi: ConsentApiClient
}

// `tenant` is worker-scoped (see the `test.extend` call below), which Playwright's fixture typing
// requires declaring as the *second* type parameter, separate from any per-test fixtures - there
// are none needed here, hence the empty first type argument.
interface WorkerFixtures {
  tenant: TenantContext
}

/**
 * Waits for a Console/portal login form to appear and fills it in. Deliberately not a call into
 * fixtures/auth.fixtures.ts's ensureSignedIn: that function is tightly coupled to the super
 * tenant's own portal base URL and to a cross-worker `.auth/` login cache, neither of which
 * applies here - every tenant this fixture creates belongs to exactly one worker for the
 * whole run, so there is nothing to cache and no other worker to race against.
 */
async function fillLoginForm(page: Page, persona: Persona): Promise<void> {
  const loginPage = new LoginPage(page)
  await loginPage.signIn(persona)
  if (await loginPage.errorMessage.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const message = (await loginPage.errorMessage.textContent())?.trim()
    throw new Error(`Sign-in failed for persona "${persona.username}": ${message ?? 'Login failed.'}`)
  }
}

/**
 * Logs into a Console URL as `persona`, in a fresh context. `consoleUrl` is a full absolute URL
 * (the super tenant's root-organizations page, or a specific tenant's own `/console`) - both are
 * different apps than the portal this suite's baseURL points at, so page.goto() here always
 * takes an absolute URL rather than relying on playwright.config.ts's baseURL.
 */
async function loginToConsole(browser: Browser, consoleUrl: string, persona: Persona): Promise<Page> {
  const context = await browser.newContext({ ignoreHTTPSErrors: env.ignoreHttpsErrors })
  const page = await context.newPage()
  await page.goto(consoleUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('#usernameUserInput').waitFor({ state: 'visible', timeout: 20_000 })
  await fillLoginForm(page, persona)
  // Deliberately not checking for a specific post-login element (e.g. the sidebar's
  // "Applications" link): confirmed empirically that the super tenant's Root Organizations page
  // renders with no sidebar at all (a different layout than a tenant's own Console shell), so no
  // single element is common to every page this function is asked to land on. The login form
  // disappearing, generically, is what every successful login has in common.
  await page.locator('#usernameUserInput').waitFor({ state: 'hidden', timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
  return page
}

/**
 * Logs into a tenant's own consent portal as `persona`, capturing the resulting auth state the
 * same way fixtures/auth.fixtures.ts's loginAndCaptureState does for the super tenant - mirrors
 * its Bearer-request-detection technique (the SPA never exposes the token any other way, see
 * utils/authStorage.ts) rather than reusing that function directly, for the same reason
 * fillLoginForm above doesn't reuse ensureSignedIn.
 */
async function loginToTenantPortal(
  browser: Browser,
  domain: string,
  persona: Persona,
): Promise<{ page: Page; authState: PersonaAuthState }> {
  // baseURL (trailing slash, same reasoning as env.ts's portalNavigationBaseUrl) is set here so
  // that page objects written against the super tenant's relative goto('purposes')-style calls
  // work unmodified against a tenant-qualified page too.
  const context = await browser.newContext({
    ignoreHTTPSErrors: env.ignoreHttpsErrors,
    baseURL: `${tenantPortalUrl(domain)}/`,
  })
  const page = await context.newPage()

  const outcome = { settled: false }
  const authenticatedRequest = page
    .waitForRequest((request) => Boolean(request.headers().authorization?.startsWith('Bearer ')), {
      timeout: 30_000,
    })
    .finally(() => {
      outcome.settled = true
    })

  await page.goto('./', { waitUntil: 'domcontentloaded' })

  const loginPage = new LoginPage(page)
  const formPoll = (async () => {
    let submitted = false
    while (!outcome.settled) {
      if (!submitted && (await page.locator('#usernameUserInput').isVisible().catch(() => false))) {
        submitted = true
        await fillLoginForm(page, persona)
      }
      if (await loginPage.errorMessage.isVisible().catch(() => false)) {
        const message = (await loginPage.errorMessage.textContent())?.trim()
        throw new Error(`Portal sign-in failed for persona "${persona.username}": ${message ?? 'Login failed.'}`)
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 250)
      })
    }
  })()
  const authenticatedReq = (await Promise.race([authenticatedRequest, formPoll])) as Request

  const authorization = authenticatedReq.headers().authorization
  if (!authorization) {
    throw new Error(`No Authorization header found on persona "${persona.username}"'s sign-in request.`)
  }

  return {
    page,
    authState: {
      storageState: await context.storageState(),
      bearerToken: authorization.replace(/^Bearer\s+/i, ''),
    },
  }
}

export const test = base.extend<object, WorkerFixtures>({
  // Worker-scoped: one throwaway tenant per worker for the whole run, not per test - the full
  // create-tenant-then-create-second-user-then-assign-role setup below is several chained
  // browser-driven steps and too slow to pay for per test. No teardown/deactivation step: every
  // run generates a fresh, unique domain (see uniqueTenantDomain), so there is nothing to free
  // up for reuse, and no real tenant delete exists on this product to call anyway.
  tenant: [
    async ({ browser }, use) => {
      const domain = uniqueTenantDomain()
      const owner: Persona = { username: uniqueMarker('tenant-owner'), password: 'TenantOwner@2026!' }
      const consentUser: Persona = { username: uniqueMarker('tenant-user'), password: 'TenantUser@2026!' }

      // Step 1: super admin creates the tenant + owner through Console's "New Root Organization"
      // wizard. Confirmed live this is the only tenant-creation path whose password field works
      // immediately - see ConsoleRootOrganizationWizard's own comment for the full comparison
      // against the raw Tenant Management REST API.
      const adminPage = await loginToConsole(browser, consoleRootOrganizationsUrl(), env.superAdmin)
      const rootOrgWizard = new ConsoleRootOrganizationWizard(adminPage)
      await rootOrgWizard.open()
      await rootOrgWizard.createTenant({
        domain,
        firstName: 'Tenant',
        lastName: 'Owner',
        username: owner.username,
        email: `${owner.username}@${domain}`,
        password: owner.password,
      })
      // Provisioning itself is synchronous (confirmed live: the accelerator's onTenantCreate
      // finishes within the same request the dialog's own POST makes), but the dialog's close
      // animation and the underlying list's refresh still need a beat before the context is torn
      // down mid-flight.
      await adminPage.waitForTimeout(2_000)
      await adminPage.context().close()

      // Step 2: the tenant owner logs into their OWN Console (never the super admin - confirmed
      // live that `admin` cannot log into a secondary tenant's Console at all, since classic
      // tenants have fully independent user stores) and creates the second, lower-privilege user.
      // Confirmed live to succeed here even though the identical `POST .../scim2/Users` call
      // 401s when replayed directly via curl - see ConsoleAddUserWizard for the full story; this
      // suite never calls SCIM2 directly as a result.
      const ownerConsolePage = await loginToConsole(browser, tenantConsoleUrl(domain), owner)
      await ownerConsolePage.goto(`${tenantConsoleUrl(domain)}/users`, { waitUntil: 'domcontentloaded' })
      const addUserWizard = new ConsoleAddUserWizard(ownerConsolePage)
      await addUserWizard.createUser({
        username: consentUser.username,
        email: `${consentUser.username}@${domain}`,
        firstName: 'Tenant',
        lastName: 'User',
        password: consentUser.password,
      })

      // Role MEMBERSHIP is never auto-provisioned, only the roles themselves - true for the
      // super tenant too (see scripts/provision-test-users.sh and docs/configuration-guide.md's
      // "Recovering a broken tenant" section) and confirmed live here: the freshly created owner
      // has no admin sidebar items at all until explicitly assigned dpdp-consent-admin. Being the
      // tenant's owner only grants Console/IS-level administration, not this custom application
      // role - the two are unrelated.
      const roleAssignment = new ConsoleRoleAssignment(ownerConsolePage)
      await ownerConsolePage.goto(`${tenantConsoleUrl(domain)}/roles`, { waitUntil: 'domcontentloaded' })
      await roleAssignment.openRoleByName('dpdp-consent-admin')
      await roleAssignment.openUsersTab()
      await roleAssignment.assignUser(owner.username)

      await ownerConsolePage.goto(`${tenantConsoleUrl(domain)}/roles`, { waitUntil: 'domcontentloaded' })
      await roleAssignment.openRoleByName('dpdp-consent-user')
      await roleAssignment.openUsersTab()
      await roleAssignment.assignUser(consentUser.username)
      await ownerConsolePage.context().close()

      // Step 3: log the owner into their own tenant-qualified portal for real, the same way
      // fixtures/auth.fixtures.ts does for the super tenant, and keep the resulting auth state
      // around as a ready-made, tenant-qualified API client - tests/05-multi-tenancy uses this to
      // seed/verify Purposes without needing their own login for every API call.
      const { page: ownerPortalPage, authState } = await loginToTenantPortal(browser, domain, owner)
      await ownerPortalPage.context().close()

      const apiContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: env.ignoreHttpsErrors })
      const ownerConsentApi = new ConsentApiClient(apiContext, authHeadersFromPersonaState(authState), domain)

      await use({ domain, owner, consentUser, ownerConsentApi })

      await apiContext.dispose()
    },
    // This setup chains three separate browser logins plus several UI wizards - the default
    // fixture timeout (tied to a single test's own timeout, 30s) is nowhere near enough.
    { scope: 'worker', timeout: 120_000 },
  ],
})

export { expect } from '@playwright/test'

/**
 * Signed-in `Page` for the tenant owner, tenant-qualified. Mirrors loginAsUser/loginAsConsentAdmin
 * from fixtures/auth.fixtures.ts in shape (caller owns the returned page's context and must close
 * it), but always logs in fresh - this persona is used by at most a couple of tests per run, so
 * the cross-worker caching machinery those functions need for the super tenant's shared,
 * many-tests-per-run personas would be pure overhead here.
 */
export async function loginAsTenantOwner(browser: Browser, tenant: TenantContext): Promise<Page> {
  const { page } = await loginToTenantPortal(browser, tenant.domain, tenant.owner)
  return page
}

/** Signed-in `Page` for the tenant's second, lower-privilege user - see `TenantContext.consentUser`. */
export async function loginAsTenantConsentUser(browser: Browser, tenant: TenantContext): Promise<Page> {
  const { page } = await loginToTenantPortal(browser, tenant.domain, tenant.consentUser)
  return page
}
