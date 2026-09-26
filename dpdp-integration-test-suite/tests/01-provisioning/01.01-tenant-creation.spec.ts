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

import { test, expect } from '@playwright/test'
import { ConsoleRootOrganizationWizard } from '../../pages/ConsoleRootOrganizationWizard'
import { loginToConsole } from '../../utils/consoleSessions'
import { isBaseUrl, superAdmin } from '../../utils/serverConfig'
import { readRunState, writeRunState } from '../../utils/runState'
import { uniqueMarker, uniqueTenantDomain } from '../../utils/testData'

// Deliberately does not import utils/env.ts - see this plan's top-level note. Only
// utils/serverConfig.ts and utils/config.ts, both safe before any persona exists.

function consoleRootOrganizationsUrl(): string {
  return `${isBaseUrl}/t/carbon.super/console/root/organizations`
}

function tenantConsoleUrl(domain: string): string {
  return `${isBaseUrl}/t/${domain}/console`
}

test.describe('Per-run tenant creation', () => {
  test('01.01.01 - Creates a fresh tenant via the root-organization wizard, and its owner can sign into it', async ({
    browser,
  }) => {
    // Two Console sign-ins plus tenant creation, and the first Console load on a freshly started
    // server - far more than the 30s default. loginToConsole alone can wait ~80s per attempt;
    // fixtures/tenant.fixtures.ts gives its longer version of this chain 240s.
    test.setTimeout(180_000)

    if (!readRunState().tenant) {
      const domain = uniqueTenantDomain()
      const owner = { username: `${uniqueMarker('tenant-owner')}@dpdp.test`, password: 'TenantOwner@2026!' }

      const adminPage = await loginToConsole(
        browser,
        consoleRootOrganizationsUrl(),
        superAdmin,
        (page) => new ConsoleRootOrganizationWizard(page).newRootOrganizationButton,
      )
      const wizard = new ConsoleRootOrganizationWizard(adminPage)
      await wizard.open()
      await wizard.createTenant({
        domain,
        firstName: 'DPDP',
        lastName: 'Owner',
        username: owner.username,
        email: owner.username,
        password: owner.password,
      })
      await adminPage.context().close()

      writeRunState({ tenant: { domain, owner } })
    }

    const { tenant } = readRunState()
    if (!tenant) {
      throw new Error('internal: tenant creation did not persist to .e2e-run-state.json')
    }

    const ownerPage = await loginToConsole(browser, tenantConsoleUrl(tenant.domain), tenant.owner)
    await expect(ownerPage).toHaveURL(new RegExp(`/t/${tenant.domain}/console`))
    await ownerPage.context().close()
  })
})
