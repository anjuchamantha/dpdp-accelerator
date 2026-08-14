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

package org.wso2.dpdp.accelerator.portal.webapp.util;

import org.wso2.carbon.context.PrivilegedCarbonContext;
import org.wso2.carbon.utils.multitenancy.MultitenantConstants;

import java.util.regex.Pattern;

/**
 * Resolves the tenant of the current request from the Carbon context.
 *
 * The Identity Server's TenantContextRewriteValve handles tenant-qualified
 * URLs ({@code /t/<tenant>/consent-portal/...}): it validates the tenant, sets
 * it in the thread-local Carbon context and forwards to this webapp, all
 * before any servlet runs. Unqualified requests ({@code /consent-portal/...})
 * run as the super tenant. The valve is enabled for this webapp by the
 * {@code [tenant_context.rewrite] custom_webapps} entry the accelerator ships
 * in deployment.toml.
 */
public final class TenantContext {

    // Tenant domains are host-name-like. The valve only ever sets registered
    // domains, but the shape is asserted anyway before the value is used in
    // URLs, redirects and cookie paths.
    private static final Pattern SAFE_TENANT_DOMAIN = Pattern.compile("[A-Za-z0-9._-]+");

    private TenantContext() {
    }

    /** Tenant domain of the current request; never null. */
    public static String tenantDomain() {

        String domain = PrivilegedCarbonContext.getThreadLocalCarbonContext().getTenantDomain();
        if (domain == null || domain.isEmpty()) {
            return MultitenantConstants.SUPER_TENANT_DOMAIN_NAME;
        }
        if (!SAFE_TENANT_DOMAIN.matcher(domain).matches()) {
            throw new IllegalStateException("The Carbon context holds a malformed tenant domain.");
        }
        return domain;
    }

    /** Tenant id matching {@link #tenantDomain()}; the super tenant id when unresolved. */
    public static int tenantId() {

        int id = PrivilegedCarbonContext.getThreadLocalCarbonContext().getTenantId();
        return id == MultitenantConstants.INVALID_TENANT_ID
                ? MultitenantConstants.SUPER_TENANT_ID : id;
    }

    public static boolean isSuperTenant(String tenantDomain) {

        return MultitenantConstants.SUPER_TENANT_DOMAIN_NAME.equals(tenantDomain);
    }

    /**
     * The URL prefix that addresses the tenant on the Identity Server: empty
     * for the super tenant (tenanted {@code /t/carbon.super} URLs are rejected
     * by default), {@code /t/<domain>} otherwise.
     */
    public static String tenantPathSegment(String tenantDomain) {

        return isSuperTenant(tenantDomain) ? "" : "/t/" + tenantDomain;
    }
}
