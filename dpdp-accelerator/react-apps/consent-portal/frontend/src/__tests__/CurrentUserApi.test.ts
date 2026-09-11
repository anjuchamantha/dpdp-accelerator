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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCurrentUser } from '../features/auth/api/currentUserApi'
import { CONSENT_HISTORY_SCOPES, IS_SCOPES } from '../utils/scopes'

const authMocks = vi.hoisted(() => ({
  getBasicUser: vi.fn(),
  isAuthEnabled: vi.fn<() => boolean>(),
  loadDeploymentConfig: vi.fn(),
}))

vi.mock('../utils/authClient', () => authMocks)

beforeEach(() => {
  authMocks.isAuthEnabled.mockReturnValue(true)
  authMocks.loadDeploymentConfig.mockResolvedValue({
    clientID: 'DPDP_CONSENT_PORTAL',
    hideSelfConsentsForAdmins: true,
    scope: [],
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('current-user API', () => {
  it('maps the SDK session onto the portal current user', async () => {
    authMocks.getBasicUser.mockResolvedValue({
      sub: 'user-1',
      username: 'admin@acme.com',
      tenantDomain: 'acme.com',
      allowedScopes: `openid ${IS_SCOPES.LOGIN} ${IS_SCOPES.CONSENT_VIEW}`,
    })

    await expect(fetchCurrentUser()).resolves.toEqual({
      userId: 'admin@acme.com',
      organizationId: 'acme.com',
      hideSelfConsentsForAdmins: true,
      scopes: ['openid', IS_SCOPES.LOGIN, IS_SCOPES.CONSENT_VIEW],
    })
  })

  it('takes the self-consent visibility choice from the deployment configuration', async () => {
    // Not part of the session: a deployment decides it, and used to reach the
    // portal through the backend's /me response.
    authMocks.loadDeploymentConfig.mockResolvedValue({
      clientID: 'DPDP_CONSENT_PORTAL',
      hideSelfConsentsForAdmins: false,
      scope: [],
    })
    authMocks.getBasicUser.mockResolvedValue({ sub: 'user-1', allowedScopes: IS_SCOPES.LOGIN })

    await expect(fetchCurrentUser()).resolves.toMatchObject({
      hideSelfConsentsForAdmins: false,
    })
  })

  it('falls back to the username and the super tenant', async () => {
    // No sub and no tenantDomain: an unqualified super-tenant session.
    authMocks.getBasicUser.mockResolvedValue({
      username: 'admin',
      allowedScopes: IS_SCOPES.LOGIN,
    })

    await expect(fetchCurrentUser()).resolves.toEqual({
      userId: 'admin',
      organizationId: 'carbon.super',
      hideSelfConsentsForAdmins: true,
      scopes: [IS_SCOPES.LOGIN],
    })
  })

  it('treats a session without scopes as granting nothing', async () => {
    authMocks.getBasicUser.mockResolvedValue({ sub: 'user-1', tenantDomain: 'acme.com' })

    await expect(fetchCurrentUser()).resolves.toMatchObject({ scopes: [] })
  })

  it('fails when there is no authenticated session', async () => {
    authMocks.getBasicUser.mockResolvedValue(undefined)

    await expect(fetchCurrentUser()).rejects.toThrow('no authenticated session')
  })

  it('fails when the session carries no subject', async () => {
    authMocks.getBasicUser.mockResolvedValue({ sub: '  ', username: '', allowedScopes: '' })

    await expect(fetchCurrentUser()).rejects.toThrow('the authenticated session has no subject')
  })

  it('returns a fully scoped development user when authentication is disabled', async () => {
    authMocks.isAuthEnabled.mockReturnValue(false)

    await expect(fetchCurrentUser()).resolves.toEqual({
      userId: 'anonymous',
      organizationId: 'carbon.super',
      hideSelfConsentsForAdmins: true,
      scopes: [...Object.values(IS_SCOPES), ...Object.values(CONSENT_HISTORY_SCOPES)],
    })
    expect(authMocks.getBasicUser).not.toHaveBeenCalled()
  })
})
