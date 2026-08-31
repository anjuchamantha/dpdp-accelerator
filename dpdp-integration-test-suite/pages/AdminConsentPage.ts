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

import { type Locator, type Page } from '@playwright/test'
import { ConsentRegistryTable } from './ConsentRegistryTable'

/** AdminConsentRegistryPage.tsx - the admin view of every subject's consents. */
export class AdminConsentPage extends ConsentRegistryTable {
  readonly consentIdSearch: Locator
  readonly advancedFiltersButton: Locator

  constructor(page: Page) {
    super(page)
    this.consentIdSearch = page.getByPlaceholder('Search by consent ID')
    this.advancedFiltersButton = page.getByRole('button', { name: 'Advanced filters' })
  }

  async goto(): Promise<void> {
    // No leading slash - see the comment in MyConsentPage.goto() for why.
    await this.page.goto('administration/consents')
  }

  async searchByConsentId(consentId: string): Promise<void> {
    await this.consentIdSearch.fill(consentId)
    await this.consentIdSearch.press('Enter')
  }

  async openAdvancedFilters(): Promise<void> {
    await this.advancedFiltersButton.click()
  }

  async filterBySubjectAndService(subjectId: string, serviceId: string): Promise<void> {
    await this.openAdvancedFilters()
    // exact: true for the same reason stateFilter below goes by role - the relation helper's
    // aria-label ("Set a User to filter by relation") also contains "User" as a substring.
    await this.page.getByLabel('User', { exact: true }).fill(subjectId)
    await this.page.getByLabel('Service', { exact: true }).fill(serviceId)
    await this.page.getByRole('button', { name: 'Apply' }).click()
  }

  get stateFilter(): Locator {
    // getByLabel('State') also matches an unrelated tooltip whose aria-label contains "state" as
    // a substring ("Remove the Consent ID filter to use the state filter."), so this goes
    // straight to the combobox by role instead.
    return this.page.getByRole('combobox', { name: 'State' })
  }

  async filterByState(stateLabel: string): Promise<void> {
    await this.stateFilter.click()
    await this.page.getByRole('option', { name: stateLabel, exact: true }).click()
  }

  activeFilterChip(labelAndValue: string): Locator {
    return this.page.getByText(labelAndValue, { exact: true })
  }

  async clearAllFilters(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear all' }).click()
  }

  /**
   * Shown by the registry TABLE itself (distinct from ConsentDetailPage.loadFailedMessage) when
   * a Consent ID search 404s - useAdminConsentListQuery does a direct GET-by-ID for consentId
   * (not a list filter like subjectId/serviceId), so a non-existent id surfaces as a load
   * failure, never as "no results".
   */
  get loadFailedMessage(): Locator {
    return this.page.getByText('Unable to load consents right now.')
  }
}
