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

import { test, expect, loginAsTenantConsentUser } from '../../fixtures/tenant.fixtures'

/**
 * The `tenant` fixture (fixtures/tenant.fixtures.ts) creates this tenant's second, lower-
 * privilege user and assigns it `dpdp-consent-user` entirely through the tenant owner's own
 * Console session - confirmed live end to end (`201` create, `200` role-assignment PATCH) where
 * the identical SCIM2 calls 401 when replayed directly via curl. This test only asserts the
 * consequence of that role assignment actually taking effect: the same route-guard behaviour
 * `04.01-route-redirects.spec.ts` already proves for the super tenant's plain `user` persona
 * (holding only `internal_login`, no admin scopes) should hold identically inside a secondary
 * tenant.
 */
test.describe('Tenant user role scoping (UI)', () => {
  test('05.03.01 - The tenant\'s second user, holding only dpdp-consent-user, is redirected away from /purposes', async ({
    browser,
    tenant,
  }) => {
    const consentUserPage = await loginAsTenantConsentUser(browser, tenant)
    await consentUserPage.goto('purposes')
    await expect(consentUserPage).toHaveURL(/\/dashboard$/)
    await consentUserPage.context().close()
  })
})
