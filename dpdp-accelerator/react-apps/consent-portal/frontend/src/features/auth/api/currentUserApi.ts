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

import type { CurrentUser } from '../../../types/auth'
import { getBasicUser, isAuthEnabled, loadDeploymentConfig } from '../../../utils/authClient'
import { tenantFromPath } from '../../../utils/basePath'
import { CONSENT_HISTORY_SCOPES, IS_SCOPES, parseScopes } from '../../../utils/scopes'

const SUPER_TENANT = 'carbon.super'

/**
 * The signed-in user, taken from the session the auth SDK holds.
 *
 * `allowedScopes` is what the Identity Server actually granted this session,
 * and that is what the UI gates on - a user without the consent management
 * scopes never sees those areas.
 *
 * `hideSelfConsentsForAdmins` is not part of the session at all: it is a
 * deployment choice, and used to reach the portal through the backend's /me
 * response. It now comes from the deployment configuration served beside the
 * application.
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const config = await loadDeploymentConfig()

  if (!isAuthEnabled()) {
    // Development only: authentication is switched off, so nothing is gated.
    return {
      userId: 'anonymous',
      organizationId: tenantFromPath() ?? SUPER_TENANT,
      hideSelfConsentsForAdmins: config.hideSelfConsentsForAdmins,
      scopes: [...Object.values(IS_SCOPES), ...Object.values(CONSENT_HISTORY_SCOPES)],
    }
  }

  const user = await getBasicUser()
  if (!user) {
    throw new Error('no authenticated session')
  }

  // Consent subjects and authorizations use the Identity Server username. The OIDC subject is
  // commonly an internal UUID and does not match those consent identifiers.
  const userId = (user.username ?? user.sub ?? '').trim()
  if (!userId) {
    throw new Error('the authenticated session has no subject')
  }

  return {
    userId,
    organizationId: user.tenantDomain?.trim() || tenantFromPath() || SUPER_TENANT,
    hideSelfConsentsForAdmins: config.hideSelfConsentsForAdmins,
    scopes: parseScopes(user.allowedScopes),
  }
}
