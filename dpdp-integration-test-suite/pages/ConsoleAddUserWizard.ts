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

export interface NewUserFields {
  username: string
  email: string
  firstName: string
  lastName: string
  password: string
}

/**
 * The three-step "Create User" wizard on a tenant's own Console, at User Management > Users >
 * "Add User" > "Single User". Confirmed live, end to end, that this succeeds
 * (`POST .../scim2/Users` -> 201) where the identical call replayed directly via curl (Basic auth
 * or a manually-attached Bearer token) 401s every time - Console's own frontend authenticates its
 * internal calls some other way a standalone `Authorization` header replay doesn't reproduce.
 * This wizard is therefore the only way this suite creates a second tenant user.
 *
 * The "Last Name" field is easy to miss: it renders with no visible error until Next is clicked,
 * at which point the wizard just silently fails to advance (no exception, no visible message
 * without scrolling) - confirmed empirically, cost real debugging time.
 */
export class ConsoleAddUserWizard {
  readonly addUserButton: Locator
  readonly singleUserOption: Locator
  readonly root: Locator
  readonly usernameField: Locator
  readonly emailField: Locator
  readonly firstNameField: Locator
  readonly lastNameField: Locator
  readonly setPasswordOption: Locator
  readonly passwordField: Locator
  readonly nextButton: Locator
  readonly saveAndContinueButton: Locator
  readonly closeButton: Locator

  // Not stored - every locator this class needs is built from it right here in the constructor.
  constructor(page: Page) {
    this.addUserButton = page.getByRole('button', { name: 'Add User' })
    this.singleUserOption = page.getByText('Single User', { exact: true })
    // Not `getByRole('dialog')` - confirmed live this wizard is a Semantic UI modal with no
    // `role="dialog"` (unlike ConsoleRootOrganizationWizard's dialog, which is a different,
    // MUI-based component) - a role-based locator here silently never matches anything.
    this.root = page.locator('.ui.modal').filter({ hasText: 'Create User' })
    this.usernameField = this.root.getByPlaceholder('Enter the username')
    this.emailField = this.root.getByPlaceholder('Enter the email address')
    this.firstNameField = this.root.getByPlaceholder('Enter the first name')
    this.lastNameField = this.root.getByPlaceholder('Enter the last name')
    this.setPasswordOption = this.root.getByText('Set a password for the user', { exact: true })
    this.passwordField = this.root.locator('input[type="password"]')
    this.nextButton = this.root.getByRole('button', { name: 'Next' })
    this.saveAndContinueButton = this.root.getByRole('button', { name: 'Save & Continue' })
    this.closeButton = this.root.getByRole('button', { name: 'Close' })
  }

  async open(): Promise<void> {
    await this.addUserButton.click()
    await this.singleUserOption.click()
  }

  /** Fills every Basic Details field, including the two easy-to-miss ones: Last Name and the
   * explicit-password option (the wizard defaults to emailing an invitation instead). */
  async fillBasicDetails(fields: NewUserFields): Promise<void> {
    await this.usernameField.fill(fields.username)
    await this.emailField.fill(fields.email)
    await this.firstNameField.fill(fields.firstName)
    await this.lastNameField.fill(fields.lastName)
    await this.setPasswordOption.click()
    await this.passwordField.fill(fields.password)
  }

  /** Basic Details -> User Groups. The existing "admin" group needs no action; this suite never
   * assigns this user to it. */
  async continueToGroups(): Promise<void> {
    await this.nextButton.click()
  }

  /** User Groups -> Invitation. Confirmed live: this is the step whose response is the actual
   * `POST .../scim2/Users` call - by the time this resolves, the user exists. */
  async continueToInvitation(): Promise<void> {
    await this.saveAndContinueButton.click()
  }

  /** Dismisses the final step, which shows the password/invitation text one last time. */
  async finish(): Promise<void> {
    await this.closeButton.click()
  }

  /** The full wizard, start to finish, for the common case of just wanting the user created. */
  async createUser(fields: NewUserFields): Promise<void> {
    await this.open()
    await this.fillBasicDetails(fields)
    await this.continueToGroups()
    await this.continueToInvitation()
    await this.finish()
  }
}
