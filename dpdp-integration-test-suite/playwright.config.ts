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

import { defineConfig, devices } from '@playwright/test'
import { config } from './utils/config'

// No webServer entry: this suite targets a real, already-running WSO2 IS + accelerator
// deployment (configured via e2e-config.json), not something this config starts itself.
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  // Every test authenticates as one of a handful of shared IS accounts (dpdp-user-1@dpdp.test,
  // dpdp-admin@dpdp.test, etc.), and IS enforces a single active session per account. fixtures/auth.fixtures.ts's
  // getPersonaState logs each persona in at most once per run (via a file-based cross-process
  // cache under .auth/, guarded by a lock only for the brief moment of that one login) precisely
  // so that multiple workers don't each log in independently and keep invalidating each other's
  // sessions - see that file for the full mechanism.
  // Capped at 2 locally to avoid resource-contention flakiness alongside WSO2 IS and MySQL on the
  // same machine - GitHub's own ubuntu-latest runner already computes the same 2 by default.
  workers: process.env.CI ? undefined : 2,
  forbidOnly: Boolean(process.env.CI),
  // 2 locally, not just CI's 1: local workers, WSO2 IS, and MySQL all share this one machine's
  // cores, so an occasional resource-contention timeout is expected - retrying absorbs that
  // without masking a deterministic failure, which still fails the same after any number of tries.
  retries: process.env.CI ? 1 : 2,
  // CI still retries so the report tells an intermittent failure from a deterministic one, and a
  // flaky setup test doesn't skip every project that depends on it - but a run that only passed
  // on a retry fails.
  failOnFlakyTests: Boolean(process.env.CI),
  reporter: [['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    ignoreHTTPSErrors: config.identityServer.ignoreHttpsErrors,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'tenant-setup',
      testMatch: /01-provisioning\/01\.01-.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Only the per-run tenant's own personas - depends on tenant-setup because it needs that
      // tenant to exist first. Kept in its own project (and its own spec file, 01.02) so
      // "super-tenant" below never has to depend on "tenant-setup" for personas it doesn't need.
      name: 'user-setup',
      testMatch: /01-provisioning\/01\.02-.*\.spec\.ts$/,
      dependencies: ['tenant-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The super tenant always exists, so this has no "tenant-setup" dependency at all.
      name: 'super-tenant-user-setup',
      testMatch: /01-provisioning\/01\.03-.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'multi-tenant',
      testIgnore: /01-provisioning\//,
      dependencies: ['user-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // 06-multi-tenancy needs a second tenant to test isolation against (the multi-tenant
      // project's own per-run tenant) - the super tenant is the only tenant this project ever
      // has, so there's nothing for it to compare against here.
      name: 'super-tenant',
      testIgnore: /(01-provisioning|06-multi-tenancy)\//,
      dependencies: ['super-tenant-user-setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
