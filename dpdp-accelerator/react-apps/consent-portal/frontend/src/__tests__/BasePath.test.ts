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

import { describe, expect, it } from 'vitest'

import { runtimeBasePath, tenantFromPath } from '../utils/basePath'

describe('runtimeBasePath', () => {
  it('returns the plain context path for unqualified URLs', () => {
    expect(runtimeBasePath('/consent-portal')).toBe('/consent-portal')
    expect(runtimeBasePath('/consent-portal/')).toBe('/consent-portal')
    expect(runtimeBasePath('/consent-portal/consents')).toBe('/consent-portal')
  })

  it('returns the tenant-qualified path for /t/<tenant> URLs', () => {
    expect(runtimeBasePath('/t/wso2.com/consent-portal')).toBe('/t/wso2.com/consent-portal')
    expect(runtimeBasePath('/t/wso2.com/consent-portal/')).toBe('/t/wso2.com/consent-portal')
    expect(runtimeBasePath('/t/wso2.com/consent-portal/admin/consents')).toBe(
      '/t/wso2.com/consent-portal',
    )
  })

  it('falls back to the context path when the URL has neither form', () => {
    expect(runtimeBasePath('/')).toBe('/consent-portal')
    expect(runtimeBasePath('/somewhere/else')).toBe('/consent-portal')
  })

  it('does not treat a longer context name as a match', () => {
    expect(runtimeBasePath('/consent-portal-other/x')).toBe('/consent-portal')
    expect(runtimeBasePath('/t/acme/consent-portal-other')).toBe('/consent-portal')
  })
})

describe('tenantFromPath', () => {
  it('extracts the tenant domain from tenant-qualified URLs', () => {
    expect(tenantFromPath('/t/wso2.com/consent-portal/consents')).toBe('wso2.com')
  })

  it('is undefined for unqualified URLs', () => {
    expect(tenantFromPath('/consent-portal/consents')).toBeUndefined()
    expect(tenantFromPath('/')).toBeUndefined()
  })
})
