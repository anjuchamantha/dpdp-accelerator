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

export interface NewTenantFields {
  domain: string
  firstName: string
  lastName: string
  username: string
  email: string
  password: string
}

/**
 * The "Create a Root Organization" dialog, opened from the super tenant's Console at
 * `/t/carbon.super/console/root/organizations` via its "New Root Organization" button. A "root
 * organization" here IS a classic WSO2 IS tenant, confirmed live: the list page it's opened from
 * is backed by `GET /api/server/v1/tenants` (the Tenant Management REST API), the exact same
 * tenants `provision-test-users.sh` and this suite's own admin persona already operate in.
 *
 * Deliberately not the raw Tenant Management REST API (`POST /api/server/v1/tenants`), even
 * though that also works: that endpoint's `owners[].password` does not actually become usable
 * for login until a separate follow-up call - confirmed live - while this dialog's password
 * field works immediately. See docs/plan discussion for the full comparison; this dialog is the
 * only tenant-creation path this suite uses.
 */
export class ConsoleRootOrganizationWizard {
  readonly root: Locator
  readonly newRootOrganizationButton: Locator
  readonly domainField: Locator
  readonly firstNameField: Locator
  readonly lastNameField: Locator
  readonly usernameField: Locator
  readonly emailField: Locator
  readonly passwordField: Locator
  readonly createButton: Locator

  // Not stored - every locator this class needs is built from it right here in the constructor;
  // there's no navigation or later-page-access method the way pages/*ListPage.ts classes have.
  constructor(page: Page) {
    this.newRootOrganizationButton = page.getByRole('button', { name: 'New Root Organization' })
    this.root = page.getByRole('dialog').filter({ hasText: 'Create a Root Organization' })
    // Placeholders carry a typographic right single-quote ('), not an ASCII apostrophe -
    // confirmed empirically; a straight-quote locator silently matches nothing.
    this.domainField = this.root.getByPlaceholder('Enter organization handle (domain)')
    this.firstNameField = this.root.getByPlaceholder('Enter the admin’s first name.')
    this.lastNameField = this.root.getByPlaceholder('Enter the admin’s last name.')
    this.usernameField = this.root.getByPlaceholder('Enter the username')
    this.emailField = this.root.getByPlaceholder('Enter the admin’s email address.')
    this.passwordField = this.root.getByPlaceholder('Enter a password for the administrator.')
    this.createButton = this.root.getByRole('button', { name: 'Create' })
  }

  async open(): Promise<void> {
    await this.newRootOrganizationButton.click()
  }

  async createTenant(fields: NewTenantFields): Promise<void> {
    await this.domainField.fill(fields.domain)
    await this.firstNameField.fill(fields.firstName)
    await this.lastNameField.fill(fields.lastName)
    await this.usernameField.fill(fields.username)
    await this.emailField.fill(fields.email)
    await this.passwordField.fill(fields.password)
    await this.createButton.click()
  }
}
