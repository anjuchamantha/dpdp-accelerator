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

import {
  AsgardeoSPAClient,
  Storage,
  type BasicUserInfo,
  type HttpRequestConfig,
  type HttpResponse,
} from '@asgardeo/auth-spa'

import { runtimeBasePath, serverBaseUrl } from './basePath'
import {
  ACCOUNT_SCOPES,
  COMPLAINT_SCOPES,
  CONSENT_HISTORY_SCOPES,
  EVENT_SCOPES,
  IS_SCOPES,
} from './scopes'

/**
 * OIDC authentication for the portal, the way the Identity Server's own SPAs
 * do it: an authorization-code flow with PKCE against a public client, with
 * the tokens held by the SDK's web worker rather than by page script.
 *
 * There is no backend of our own - the SPA talks to the Identity Server
 * directly, so every API call goes through {@link httpRequest} to have the
 * worker attach the access token.
 */

export type UserProfile = Record<string, unknown>

/** Shape of the runtime configuration served beside the app. */
export interface DeploymentConfig {
  clientID: string
  scope: string[]
  /**
   * Whether to hide the self-service consent navigation from users who can
   * also administer other people's consents. Purely a presentation choice -
   * an administrator's own consents stay reachable by URL.
   */
  hideSelfConsentsForAdmins: boolean
}

/** The authorization-code handoff published by auth.jsp. */
interface AuthHandoff {
  authCode: string
  sessionState: string
  state: string
}

const DEFAULT_CLIENT_ID = 'DPDP_CONSENT_PORTAL'

/** Where the route being visited is kept across the trip to the Identity Server. */
const RETURN_PATH_KEY = 'consent-portal.returnPath'

const DEFAULT_SCOPE: string[] = [
  'openid',
  'profile',
  ...Object.values(IS_SCOPES),
  ...Object.values(EVENT_SCOPES),
  ...Object.values(CONSENT_HISTORY_SCOPES),
  ...Object.values(COMPLAINT_SCOPES),
  ...Object.values(ACCOUNT_SCOPES),
]

let initPromise: Promise<void> | undefined

function spaClient(): AsgardeoSPAClient {
  const instance = AsgardeoSPAClient.getInstance()
  if (!instance) {
    throw new Error('the authentication client is unavailable')
  }
  return instance
}

export function isAuthEnabled(): boolean {
  return import.meta.env.VITE_AUTH_ENABLED === 'true'
}

async function readDeploymentConfig(): Promise<DeploymentConfig> {
  const fallback: DeploymentConfig = {
    clientID: DEFAULT_CLIENT_ID,
    hideSelfConsentsForAdmins: true,
    scope: DEFAULT_SCOPE,
  }
  try {
    const response = await fetch(`${runtimeBasePath()}/deployment.config.json`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return fallback
    }
    const config = (await response.json()) as Partial<DeploymentConfig>
    return {
      clientID: config.clientID?.trim() || fallback.clientID,
      hideSelfConsentsForAdmins:
        typeof config.hideSelfConsentsForAdmins === 'boolean'
          ? config.hideSelfConsentsForAdmins
          : fallback.hideSelfConsentsForAdmins,
      scope: Array.isArray(config.scope) && config.scope.length ? config.scope : fallback.scope,
    }
  } catch {
    // A missing or unparseable config is not fatal - the defaults describe the
    // application the accelerator provisions automatically for every tenant.
    return fallback
  }
}

let configPromise: Promise<DeploymentConfig> | undefined

/**
 * The deployment configuration, fetched once per page load. Both the SDK setup
 * and the presentation choices the portal reads from it share this one read.
 */
export async function loadDeploymentConfig(): Promise<DeploymentConfig> {
  if (!configPromise) {
    configPromise = readDeploymentConfig().catch((error: unknown) => {
      // Let the next caller retry rather than caching the failure.
      configPromise = undefined
      throw error
    })
  }
  return configPromise
}

/**
 * Initialises the SDK once per page load. The Identity Server base is
 * tenant-qualified, so the same build serves every tenant.
 */
export async function initAuth(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const config = await loadDeploymentConfig()
      // No trailing slash: the server answers "/consent-portal/" with a 302 to
      // the unslashed form, so asking for the slashed one costs an extra round
      // trip on every sign-in. My Account registers the unslashed form too.
      const appHome = `${window.location.origin}${runtimeBasePath()}`
      await spaClient().initialize({
        baseUrl: serverBaseUrl(),
        clientID: config.clientID,
        enablePKCE: true,
        resourceServerURLs: [serverBaseUrl()],
        scope: config.scope,
        signInRedirectURL: appHome,
        signOutRedirectURL: appHome,
        storage: Storage.WebWorker,
      })
    })().catch((error: unknown) => {
      // Let the next attempt retry instead of caching the failure.
      initPromise = undefined
      throw error
    })
  }
  return initPromise
}

/**
 * Reads the one-shot authorization code that home.jsp parked in the HTTP
 * session, so the code is never taken from the browser URL. Absent in dev,
 * where Vite serves the app without the JSPs.
 */
async function readAuthHandoff(): Promise<AuthHandoff | undefined> {
  try {
    const response = await fetch(`${runtimeBasePath()}/auth`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      return undefined
    }
    const body = (await response.text()).trim()
    if (!body) {
      return undefined
    }
    const handoff = JSON.parse(body) as Partial<AuthHandoff>
    return handoff.authCode
      ? {
          authCode: handoff.authCode,
          sessionState: handoff.sessionState ?? '',
          state: handoff.state ?? '',
        }
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Records the route being visited before the browser leaves for the Identity
 * Server. Sign-in always returns to the registered redirect URI - the
 * application home - so without this a reload on any other route lands the
 * user back at the default page.
 *
 * The route is stored relative to {@link runtimeBasePath}, which is what the
 * router navigates by, and only ever a path: never a token.
 */
function rememberReturnPath(): void {
  try {
    const base = runtimeBasePath()
    const { pathname, search } = window.location
    const route = pathname.startsWith(base) ? pathname.slice(base.length) : pathname
    const target = `${route.startsWith('/') ? route : `/${route}`}${search}`
    if (target === '/') {
      return
    }
    sessionStorage.setItem(RETURN_PATH_KEY, target)
  } catch {
    // Storage can be unavailable or full; returning to the default page is a
    // far better outcome than failing the sign-in.
  }
}

/**
 * The remembered route, handed over once and then forgotten. Anything that is
 * not a local path is discarded - a stored "//host" would navigate off site.
 */
export function takeReturnPath(): string | undefined {
  try {
    const saved = sessionStorage.getItem(RETURN_PATH_KEY)
    sessionStorage.removeItem(RETURN_PATH_KEY)
    return saved?.startsWith('/') && !saved.startsWith('//') ? saved : undefined
  } catch {
    return undefined
  }
}

export async function isAuthenticated(): Promise<boolean> {
  if (!isAuthEnabled()) {
    return true
  }
  await initAuth()
  return (await spaClient().isAuthenticated()) ?? false
}

/**
 * Completes an in-flight sign-in, or starts one.
 *
 * Returns true when the session is ready, and false only when the browser is
 * on its way to the Identity Server - the caller should draw nothing and let
 * the navigation happen. Anything else throws, so a caller waiting on the
 * redirect never waits on something that is not coming.
 */
export async function ensureSignedIn(): Promise<boolean> {
  if (!isAuthEnabled()) {
    return true
  }
  await initAuth()
  const client = spaClient()
  if (await client.isAuthenticated()) {
    return true
  }

  const handoff = await readAuthHandoff()
  if (handoff) {
    await client.signIn(
      { callOnlyOnRedirect: false },
      handoff.authCode,
      handoff.sessionState,
      handoff.state,
    )
    if (await client.isAuthenticated()) {
      return true
    }
    // Nothing is navigating on this path, so returning false would leave the
    // caller waiting for a redirect that never comes. A token exchange that
    // fails outright rejects before this; reaching here means it resolved
    // without a usable session - an expiry already in the past, say.
    throw new Error('the sign-in completed without establishing a session')
  }

  // No pending code: hand over to the Identity Server. In dev the SDK picks
  // the code up from the redirect's query parameters instead.
  rememberReturnPath()
  await client.signIn()
  return (await client.isAuthenticated()) ?? false
}

/** Starts a fresh sign-in, discarding any half-finished session. */
export async function login(): Promise<void> {
  if (!isAuthEnabled()) {
    return
  }
  await initAuth()
  rememberReturnPath()
  await spaClient().signIn()
}

/** Ends the Identity Server session; token revocation is done server-side. */
export async function logout(): Promise<void> {
  if (!isAuthEnabled()) {
    return
  }
  await initAuth()
  await spaClient().signOut()
}

/**
 * Best-effort local teardown for when the account itself is gone: an OIDC
 * logout redirect would ask the Identity Server about a user that no longer
 * exists. revokeAccessToken() revokes the token and clears the worker-held
 * session without navigating anywhere.
 */
export async function clearLocalSession(): Promise<void> {
  if (!isAuthEnabled()) {
    return
  }
  await initAuth()
  try {
    await spaClient().revokeAccessToken()
  } catch {
    // The account is already deleted server-side; a failed revocation leaves
    // only a token that no longer belongs to anyone.
  }
}

export async function getBasicUser(): Promise<BasicUserInfo | undefined> {
  await initAuth()
  return spaClient().getBasicUserInfo()
}

/** Claims from the ID token, used for the profile menu. */
export async function getUserProfile(): Promise<UserProfile | undefined> {
  if (!isAuthEnabled()) {
    return undefined
  }
  await initAuth()
  return (await spaClient().getDecodedIDToken()) as UserProfile | undefined
}

/**
 * Performs an authenticated request. With worker-held tokens the page cannot
 * read the access token, so the worker attaches it on our behalf.
 */
export async function httpRequest(config: HttpRequestConfig): Promise<HttpResponse | undefined> {
  await initAuth()
  return spaClient().httpRequest(config)
}
