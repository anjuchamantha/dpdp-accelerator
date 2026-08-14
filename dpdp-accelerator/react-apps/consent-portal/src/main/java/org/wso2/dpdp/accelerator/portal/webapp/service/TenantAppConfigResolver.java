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

package org.wso2.dpdp.accelerator.portal.webapp.service;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.wso2.carbon.context.PrivilegedCarbonContext;
import org.wso2.carbon.identity.configuration.mgt.core.ConfigurationManager;
import org.wso2.carbon.identity.configuration.mgt.core.exception.ConfigurationManagementClientException;
import org.wso2.carbon.identity.configuration.mgt.core.exception.ConfigurationManagementException;
import org.wso2.carbon.identity.configuration.mgt.core.model.Attribute;
import org.wso2.carbon.identity.configuration.mgt.core.model.Resource;
import org.wso2.carbon.identity.configuration.mgt.core.model.ResourceTypeAdd;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the portal's OAuth client credentials for a tenant from the
 * Identity Server's Configuration Management store.
 *
 * Each tenant that uses the portal registers its own OAuth application, then
 * stores the credentials as a config-mgt resource of type
 * {@value #RESOURCE_TYPE}, name {@value #RESOURCE_NAME}, with
 * {@value #ATTR_CLIENT_ID} and {@value #ATTR_CLIENT_SECRET} attributes —
 * writable per tenant over {@code /t/<tenant>/api/identity/config-mgt/v1.0}.
 * The store is tenant-partitioned, so tenants can never read each other's
 * entries.
 *
 * Reads go through the in-JVM {@link ConfigurationManager} OSGi service (the
 * webapp runs in the Carbon classloading environment), so the portal needs no
 * credentials of its own to fetch them. Results are cached for a short TTL:
 * onboarding a tenant or rotating a secret needs no server restart.
 */
public final class TenantAppConfigResolver {

    public static final String RESOURCE_TYPE = "dpdp-portal";
    public static final String RESOURCE_NAME = "oauth-app";
    public static final String ATTR_CLIENT_ID = "client_id";
    public static final String ATTR_CLIENT_SECRET = "client_secret";

    private static final Log LOG = LogFactory.getLog(TenantAppConfigResolver.class);
    private static final long CACHE_TTL_MILLIS = 2 * 60 * 1000L;
    private static final TenantAppConfigResolver INSTANCE = new TenantAppConfigResolver();

    /** Credentials of a tenant's portal application; both fields may be null. */
    public static final class OAuthAppCredentials {

        private final String clientId;
        private final String clientSecret;

        OAuthAppCredentials(String clientId, String clientSecret) {

            this.clientId = clientId;
            this.clientSecret = clientSecret;
        }

        public String getClientId() {

            return clientId;
        }

        public String getClientSecret() {

            return clientSecret;
        }

        public boolean isComplete() {

            return clientId != null && !clientId.isEmpty()
                    && clientSecret != null && !clientSecret.isEmpty();
        }
    }

    private static final class CacheEntry {

        private final OAuthAppCredentials credentials;
        private final long expiresAt;

        CacheEntry(OAuthAppCredentials credentials, long expiresAt) {

            this.credentials = credentials;
            this.expiresAt = expiresAt;
        }
    }

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final Object resourceTypeLock = new Object();
    private volatile boolean resourceTypeEnsured;

    private TenantAppConfigResolver() {
    }

    public static TenantAppConfigResolver getInstance() {

        return INSTANCE;
    }

    /**
     * Returns the tenant's stored credentials, or an empty holder when none
     * are stored. Never throws: a config-store failure logs and resolves to
     * empty so the caller falls back or reports "not configured".
     */
    public OAuthAppCredentials resolve(String tenantDomain, int tenantId) {

        long now = System.currentTimeMillis();
        CacheEntry entry = cache.get(tenantDomain);
        if (entry != null && entry.expiresAt > now) {
            return entry.credentials;
        }

        OAuthAppCredentials credentials = load(tenantDomain, tenantId);
        cache.put(tenantDomain, new CacheEntry(credentials, now + CACHE_TTL_MILLIS));
        return credentials;
    }

    private OAuthAppCredentials load(String tenantDomain, int tenantId) {

        ConfigurationManager manager = configurationManager();
        if (manager == null) {
            LOG.warn("The ConfigurationManager OSGi service is unavailable; "
                    + "cannot read portal credentials for tenant " + tenantDomain + ".");
            return new OAuthAppCredentials(null, null);
        }

        ensureResourceType(manager);

        try {
            Resource resource = manager.getResourceByTenantId(tenantId, RESOURCE_TYPE, RESOURCE_NAME);
            String clientId = null;
            String clientSecret = null;
            if (resource != null && resource.getAttributes() != null) {
                for (Attribute attribute : resource.getAttributes()) {
                    if (ATTR_CLIENT_ID.equals(attribute.getKey())) {
                        clientId = attribute.getValue();
                    } else if (ATTR_CLIENT_SECRET.equals(attribute.getKey())) {
                        clientSecret = attribute.getValue();
                    }
                }
            }
            return new OAuthAppCredentials(clientId, clientSecret);
        } catch (ConfigurationManagementClientException e) {
            // Resource (or type) not there yet: the tenant simply has not
            // stored credentials. Not an error.
            if (LOG.isDebugEnabled()) {
                LOG.debug("No portal credentials stored for tenant " + tenantDomain + ": " + e.getErrorCode());
            }
            return new OAuthAppCredentials(null, null);
        } catch (ConfigurationManagementException e) {
            LOG.error("Failed to read portal credentials for tenant " + tenantDomain + ".", e);
            return new OAuthAppCredentials(null, null);
        }
    }

    /**
     * Creates the global {@value #RESOURCE_TYPE} resource type on first use so
     * tenant administrators can store resources under it without a manual
     * super-tenant bootstrap step. Idempotent; concurrent creation loses
     * harmlessly to "already exists".
     */
    private void ensureResourceType(ConfigurationManager manager) {

        if (resourceTypeEnsured) {
            return;
        }
        synchronized (resourceTypeLock) {
            if (resourceTypeEnsured) {
                return;
            }
            try {
                manager.getResourceType(RESOURCE_TYPE);
                resourceTypeEnsured = true;
            } catch (ConfigurationManagementClientException e) {
                try {
                    ResourceTypeAdd type = new ResourceTypeAdd();
                    type.setName(RESOURCE_TYPE);
                    type.setDescription("DPDP consent portal per-tenant configuration.");
                    manager.addResourceType(type);
                    resourceTypeEnsured = true;
                    LOG.info("Created the '" + RESOURCE_TYPE + "' configuration resource type.");
                } catch (ConfigurationManagementException addFailure) {
                    // A concurrent creator (another node) may have won; the
                    // next resolve() retries the check.
                    LOG.warn("Could not create the '" + RESOURCE_TYPE + "' resource type.", addFailure);
                }
            } catch (ConfigurationManagementException e) {
                LOG.warn("Could not verify the '" + RESOURCE_TYPE + "' resource type.", e);
            }
        }
    }

    private ConfigurationManager configurationManager() {

        try {
            Object service = PrivilegedCarbonContext.getThreadLocalCarbonContext()
                    .getOSGiService(ConfigurationManager.class, null);
            return (ConfigurationManager) service;
        } catch (RuntimeException e) {
            LOG.error("Failed to look up the ConfigurationManager OSGi service.", e);
            return null;
        }
    }
}
