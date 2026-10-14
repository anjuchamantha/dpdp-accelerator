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

'use strict';

const CONSENT_MGT_PATH = '/api/identity/consent-mgt/v2.0';
const SCOPES = [
  'internal_consent_mgt_purpose_view',
  'internal_consent_mgt_consent_create',
  'internal_consent_mgt_consent_view',
  'internal_consent_mgt_consent_update',
];
const TOKEN_REFRESH_MARGIN_MS = 30 * 1000;
const LIST_LIMIT = 100;

class IsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'IsApiError';
    this.status = status;
  }
}

/**
 * subjectQuery 'property' filters on the subjectRef property instead of IS's userId filter, for
 * an IS where userId does not match subjects that are not IS users (scripts/verify-is-api.mjs).
 */
function createIsClient({
  baseUrl, clientId, clientSecret, fetch = globalThis.fetch, onApiCall = () => {}, now = Date.now, subjectQuery = 'userId',
}) {
  let token = null;
  let tokenExpiresAt = 0;

  async function getToken() {
    if (token && tokenExpiresAt > now() + TOKEN_REFRESH_MARGIN_MS) return token;
    let response;
    try {
      response = await fetch(`${baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPES.join(' ') }).toString(),
      });
    } catch (e) {
      // fetch's own message contains the request URL, which carries the subject id.
      throw new IsApiError('Could not reach Identity Server for a cookie consent token', 0);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw new IsApiError('Could not get an access token for cookie consent', response.status);
    }
    token = data.access_token;
    tokenExpiresAt = now() + (data.expires_in || 3600) * 1000;
    return token;
  }

  async function call(method, path, body) {
    const url = `${baseUrl}${CONSENT_MGT_PATH}${path}`;
    const headers = { Authorization: `Bearer ${await getToken()}`, Accept: 'application/json' };
    const options = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch (e) {
      // fetch's own message contains the request URL, which carries the subject id.
      throw new IsApiError(`${method} ${path.split('?')[0]} failed: network error`, 0);
    }
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { raw: text };
    }
    onApiCall({ method, url, reqBody: body === undefined ? null : body, status: response.status, resBody: data });
    if (!response.ok) {
      throw new IsApiError(`${method} ${path.split('?')[0]} failed with HTTP ${response.status}`, response.status);
    }
    return data;
  }

  return {
    async findPurposeByName(name) {
      const list = await call('GET', `/purposes?filter=${encodeURIComponent(`name eq "${name}"`)}`);
      const summary = list && Array.isArray(list.Purposes) ? list.Purposes.find((p) => p.name === name) : undefined;
      if (!summary) return null;
      return call('GET', `/purposes/${encodeURIComponent(summary.id)}`);
    },

    async listCookieConsents(subjectId, serviceId) {
      const query = new URLSearchParams({ serviceId, attributes: 'purposes,properties', limit: String(LIST_LIMIT) });
      if (subjectQuery === 'property') {
        query.set('filter', `properties.consentType eq cookie and properties.subjectRef eq ${subjectId}`);
      } else {
        query.set('userId', subjectId);
        query.set('relation', 'SUBJECT');
        query.set('filter', 'properties.consentType eq cookie');
      }
      const data = await call('GET', `/consents?${query.toString()}`);
      return data && Array.isArray(data.Consents) ? data.Consents : [];
    },

    createConsent(body) {
      return call('POST', '/consents', body);
    },

    async revokeConsent(consentId) {
      await call('POST', `/consents/${encodeURIComponent(consentId)}/revoke`);
    },
  };
}

module.exports = { createIsClient, IsApiError, SCOPES };
