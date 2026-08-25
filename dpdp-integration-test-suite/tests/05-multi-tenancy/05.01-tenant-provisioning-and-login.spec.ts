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

import { test, expect, loginAsTenantOwner } from '../../fixtures/tenant.fixtures'
import { PurposeFormDialog } from '../../pages/PurposeFormDialog'
import { PurposeListPage } from '../../pages/PurposeListPage'
import { uniquePurposeName } from '../../utils/testData'

/**
 * `DPDPIdentityExtensionTenantMgtListener.onTenantCreate` has never been exercised by any
 * automated test before this - see the `tenant` fixture (fixtures/tenant.fixtures.ts) for how
 * the throwaway tenant this test signs into gets created, entirely through Console, once per
 * worker. A successful sign-in tenant-qualified already proves the accelerator provisioned both
 * the DPDP Consent Portal application and its roles for this tenant, so no separate SCIM2 role
 * check is needed here (SCIM2 against a secondary tenant is confirmed broken on this build - see
 * the fixture's comments).
 */
test.describe('Tenant provisioning and tenant-qualified portal access (UI)', () => {
  test('05.01.01 - The tenant owner can sign in tenant-qualified and create a Purpose', async ({ browser, tenant }) => {
    const ownerPage = await loginAsTenantOwner(browser, tenant)
    // basePath.ts's tenant-qualified branch: confirms the SPA itself resolved
    // /t/<tenant>/consent-portal as its own base, not the super-tenant path.
    await expect(ownerPage).toHaveURL(new RegExp(`/t/${tenant.domain}/consent-portal/dashboard$`))

    const listPage = new PurposeListPage(ownerPage)
    await listPage.goto()
    await listPage.openCreateDialog()

    const dialog = new PurposeFormDialog(ownerPage)
    await dialog.fill({ name: uniquePurposeName(), type: 'Policy', version: 'v1' })
    await dialog.submit()

    // Proves the tenant-prefixed consent-mgt v2 API call the form submits to actually worked.
    await expect(ownerPage).toHaveURL(/\/purposes\/[^/]+$/)
    await ownerPage.context().close()
  })
})
