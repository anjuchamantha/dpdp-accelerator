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

/**
 * A role's detail page on a tenant's own Console (User Management > Roles > <role name>), scoped
 * to its "Users" tab and the "Assign User" dialog it opens. Confirmed live, end to end, that this
 * succeeds (`PATCH .../scim2/v2/Roles/{id}` -> 200, "Role updated successfully") where the
 * identical call replayed directly via curl 401s every time - same story as
 * ConsoleAddUserWizard, and the reason this suite drives role assignment through here rather
 * than through any direct SCIM2/REST call.
 */
export class ConsoleRoleAssignment {
  readonly usersTab: Locator
  readonly assignUserButton: Locator
  readonly saveButton: Locator

  constructor(private readonly page: Page) {
    this.usersTab = page.getByText('Users', { exact: true })
    this.assignUserButton = page.getByRole('button', { name: 'Assign User' })
    // Scoped to the dialog itself, not the page - the role detail page's own "Assign User"
    // button that opens this dialog has a different, unrelated label ("Assign User" too, but a
    // different element instance), and the dialog's Save button is the one that actually issues
    // the PATCH.
    this.saveButton = page.getByRole('button', { name: 'Save' })
  }

  /** Navigates from the Roles list (already on-screen) to one role's detail page by name. */
  async openRoleByName(roleName: string): Promise<void> {
    await this.page.getByText(roleName, { exact: true }).first().click()
  }

  async openUsersTab(): Promise<void> {
    await this.usersTab.first().click()
  }

  /**
   * Assigns `username` to the role open in the Users tab. The "Assign User" dialog renders every
   * unassigned user in the tenant as a table row (`<td>` pair: a checkbox, then the display name
   * plus the username in a `<code>` tag) - confirmed empirically. The checkbox's underlying
   * `<input>` is itself hidden and readonly (Semantic UI's pattern); the row's `.ui.checkbox`
   * wrapper is what actually toggles it on click.
   */
  async assignUser(username: string): Promise<void> {
    await this.assignUserButton.click()
    const row = this.page.getByRole('row').filter({ hasText: username })
    await row.locator('.ui.checkbox').click()
    await this.saveButton.click()
  }
}
