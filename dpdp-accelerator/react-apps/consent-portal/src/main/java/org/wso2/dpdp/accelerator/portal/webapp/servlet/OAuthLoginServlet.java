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

package org.wso2.dpdp.accelerator.portal.webapp.servlet;

import org.wso2.dpdp.accelerator.portal.webapp.service.OAuthService;
import org.wso2.dpdp.accelerator.portal.webapp.util.CookieUtil;
import org.wso2.dpdp.accelerator.portal.webapp.util.HttpUtil;
import org.wso2.dpdp.accelerator.portal.webapp.util.PortalConstants;
import org.wso2.dpdp.accelerator.portal.webapp.util.TenantPortalConfig;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Starts the OIDC authorization-code flow (with PKCE) against the request
 * tenant's authorization endpoint. The state and code verifier are stored in
 * a short-lived HttpOnly cookie until the callback returns.
 */
@WebServlet(urlPatterns = "/auth/login")
public class OAuthLoginServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {

        TenantPortalConfig config = TenantPortalConfig.forRequest(getServletContext());
        if (!config.isConfigured()) {
            HttpUtil.sendError(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    PortalConstants.ERROR_NOT_CONFIGURED,
                    "The consent portal is not configured for tenant " + config.getTenantDomain()
                            + ". Register the portal application and store its client credentials first.");
            return;
        }

        String state = OAuthService.generateRandomToken();
        String codeVerifier = OAuthService.generateRandomToken();
        String codeChallenge = OAuthService.codeChallengeS256(codeVerifier);
        String redirectUri = config.getPortalExternalUrl() + "/auth/callback";

        String transaction = Base64.getUrlEncoder().withoutPadding()
                .encodeToString((state + ":" + codeVerifier).getBytes(StandardCharsets.UTF_8));
        // SameSite=Lax so the cookie is sent on the top-level redirect back from the Identity Server.
        CookieUtil.addCookie(response, PortalConstants.AUTH_TRANSACTION_COOKIE, transaction,
                config.getPortalExternalPath() + "/auth", PortalConstants.AUTH_TRANSACTION_MAX_AGE_SECONDS,
                true, config.isCookieSecure(), "Lax");

        response.sendRedirect(OAuthService.getInstance()
                .buildAuthorizeUrl(config, redirectUri, state, codeChallenge));
    }
}
