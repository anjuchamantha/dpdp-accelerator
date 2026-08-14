/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The portal's base path, detected from the browser URL at runtime.
 *
 * The Identity Server serves the portal both unqualified ("/consent-portal")
 * and tenant-qualified ("/t/<tenant>/consent-portal"), so the base cannot be
 * baked in at build time. The build-time base (import.meta.env.BASE_URL) is
 * still used for static assets, which are tenant-agnostic.
 */

const CONTEXT_SEGMENT = '/consent-portal'

/**
 * Returns "/t/<tenant>/consent-portal" when the page is served under a
 * tenant-qualified URL, "/consent-portal" otherwise (including in dev, where
 * the path may not contain the context segment at all).
 */
export function runtimeBasePath(pathname: string = window.location.pathname): string {
  const match = pathname.match(/^(\/t\/[^/]+)?\/consent-portal(?:\/|$)/)
  return match ? `${match[1] ?? ''}${CONTEXT_SEGMENT}` : CONTEXT_SEGMENT
}

/** The tenant domain from a tenant-qualified URL, or undefined. */
export function tenantFromPath(pathname: string = window.location.pathname): string | undefined {
  return pathname.match(/^\/t\/([^/]+)\/consent-portal(?:\/|$)/)?.[1]
}
