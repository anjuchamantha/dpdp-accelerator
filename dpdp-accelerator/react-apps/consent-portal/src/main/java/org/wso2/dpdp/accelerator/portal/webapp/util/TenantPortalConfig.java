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

import org.wso2.dpdp.accelerator.portal.webapp.service.TenantAppConfigResolver;

import javax.servlet.ServletContext;

/**
 * The tenant's view of the portal configuration for one request.
 *
 * Wraps the deployment-wide {@link PortalConfig} with the tenant resolved
 * from the Carbon context, and derives everything that differs per tenant:
 * OAuth client credentials (config-mgt store first, with the properties file
 * as a super-tenant fallback), tenant-qualified Identity Server endpoints,
 * and the externally visible portal path used for redirect URIs and cookie
 * scoping ({@code /t/<tenant>/consent-portal} for tenants).
 */
public final class TenantPortalConfig {

    private final PortalConfig config;
    private final String tenantDomain;
    private final TenantAppConfigResolver.OAuthAppCredentials credentials;

    private TenantPortalConfig(PortalConfig config, String tenantDomain,
                               TenantAppConfigResolver.OAuthAppCredentials credentials) {

        this.config = config;
        this.tenantDomain = tenantDomain;
        this.credentials = credentials;
    }

    /** Builds the view for the current request's tenant. */
    public static TenantPortalConfig forRequest(ServletContext servletContext) {

        PortalConfig config = PortalConfig.getInstance(servletContext);
        String tenantDomain = TenantContext.tenantDomain();
        TenantAppConfigResolver.OAuthAppCredentials credentials =
                TenantAppConfigResolver.getInstance().resolve(tenantDomain, TenantContext.tenantId());
        return new TenantPortalConfig(config, tenantDomain, credentials);
    }

    public String getTenantDomain() {

        return tenantDomain;
    }

    /** {@code ""} for the super tenant, {@code /t/<domain>} otherwise. */
    public String getTenantPathSegment() {

        return TenantContext.tenantPathSegment(tenantDomain);
    }

    /**
     * The browser-facing portal base path for this tenant
     * ({@code [/t/<tenant>]/consent-portal}) — redirect URIs and cookie paths
     * must use this, not the servlet context path, so each tenant's session
     * cookies stay scoped to its own URL space.
     */
    public String getPortalExternalPath() {

        return getTenantPathSegment() + config.getPortalBasePath();
    }

    /**
     * The browser-facing absolute URL of the portal for this tenant
     * ({@code https://<host>:<port>[/t/<tenant>]/consent-portal}) — the base
     * for redirect URIs.
     */
    public String getPortalExternalUrl() {

        return config.getIdentityServerBaseUrl() + getPortalExternalPath();
    }

    /** Browser-facing Identity Server base, tenant-qualified. */
    public String getExternalTenantBaseUrl() {

        return config.getIdentityServerBaseUrl() + getTenantPathSegment();
    }

    /** Server-to-server Identity Server base, tenant-qualified. */
    public String getInternalTenantBaseUrl() {

        return config.getIdentityServerInternalBaseUrl() + getTenantPathSegment();
    }

    /**
     * Client id from the tenant's config-mgt entry; the super tenant falls
     * back to dpdp-portal.properties / web.xml so existing single-tenant
     * installs keep working.
     */
    public String getClientId() {

        if (credentials.getClientId() != null && !credentials.getClientId().isEmpty()) {
            return credentials.getClientId();
        }
        return TenantContext.isSuperTenant(tenantDomain) ? config.getClientId() : null;
    }

    /** Client secret, resolved the same way as {@link #getClientId()}. */
    public String getClientSecret() {

        if (credentials.getClientSecret() != null && !credentials.getClientSecret().isEmpty()) {
            return credentials.getClientSecret();
        }
        return TenantContext.isSuperTenant(tenantDomain) ? config.getClientSecret() : null;
    }

    /** True when a usable client id and secret exist for this tenant. */
    public boolean isConfigured() {

        String clientId = getClientId();
        String clientSecret = getClientSecret();
        return clientId != null && !clientId.isEmpty() && clientSecret != null && !clientSecret.isEmpty();
    }

    public String getScopes() {

        return config.getScopes();
    }

    public boolean isCookieSecure() {

        return config.isCookieSecure();
    }

    public String getOrgIdClaim() {

        return config.getOrgIdClaim();
    }
}
