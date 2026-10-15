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

const { newVisitorId: defaultNewVisitorId } = require('./subjectCookie');
const { resolveState, resolveAfter, planChanges, decisionsToLink, decisionConsentIds } = require('./consentState');

const DAY_MS = 24 * 60 * 60 * 1000;

class StaleRevisionError extends Error {
  constructor() {
    super('The cookie categories changed since the banner was shown');
    this.name = 'StaleRevisionError';
  }
}

function bannerConfig(catalog, texts) {
  return {
    texts,
    categories: catalog.categories.map((c) => ({
      key: c.key,
      title: c.title,
      description: c.description,
      cookies: c.elements.map((e) => ({ name: e.name, description: e.description || e.displayName })),
    })),
  };
}

function createCookieConsentService({
  isClient, catalog, serviceId, siteName, texts, language = 'en', expiryDays = 365, now = Date.now,
  newVisitorId = defaultNewVisitorId, onError = () => {},
}) {
  function listFor(subject) {
    return isClient.listCookieConsents(subject, serviceId);
  }

  function withConfig(state, currentCatalog) {
    return { ...state, config: bannerConfig(currentCatalog, texts) };
  }

  async function stateFor(subject, currentCatalog) {
    const records = subject ? await listFor(subject) : [];
    return withConfig(resolveState(records, currentCatalog), currentCatalog);
  }

  async function execute(subject, ops, currentCatalog, extraProperties = {}) {
    for (const op of ops) {
      if (op.op === 'revoke') {
        await isClient.revokeConsent(op.consentId);
        continue;
      }
      const category = currentCatalog.categories.find((c) => c.key === op.category);
      await isClient.createConsent({
        subjectId: subject,
        serviceId,
        language,
        purposes: [{ id: category.purposeId, elements: category.elements.map((e) => ({ id: e.id })) }],
        state: op.state,
        expiryTime: now() + expiryDays * DAY_MS,
        properties: {
          consentType: 'cookie', category: category.key, siteName, subjectRef: subject, ...extraProperties[category.key],
        },
      });
    }
  }

  return {
    async getState({ username, cookie }) {
      const subject = username || (cookie && (cookie.u || cookie.v)) || null;
      return stateFor(subject, await catalog.get());
    },

    async saveDecision({ username, cookie, categories, revision }) {
      const currentCatalog = await catalog.get();
      if (revision !== currentCatalog.revision) throw new StaleRevisionError();

      let nextCookie;
      let isNewVisitor = false;
      if (username) {
        nextCookie = { v: (cookie && cookie.v) || newVisitorId(), u: username };
      } else if (cookie && !cookie.u) {
        nextCookie = cookie;
      } else {
        // A browser linked to a user who has logged out: a change made here belongs to whoever is
        // using the browser now, so it never goes onto that user's record.
        nextCookie = { v: newVisitorId(), u: null };
        isNewVisitor = true;
      }
      const subject = username || nextCookie.v;
      const records = isNewVisitor ? [] : await listFor(subject);
      await execute(subject, planChanges(records, currentCatalog, categories), currentCatalog);
      // Every write succeeded (a failure throws), so the new state follows from the records read
      // above and the decision; reading it back from Identity Server would cost a call per save.
      return { cookie: nextCookie, state: withConfig(resolveAfter(records, currentCatalog, categories), currentCatalog) };
    },

    async linkOnLogin({ username, cookie }) {
      if (!cookie) return { v: newVisitorId(), u: username };
      if (cookie.u && cookie.u !== username) return { v: cookie.v, u: username };
      const currentCatalog = await catalog.get();
      const [visitorRecords, userRecords] = await Promise.all([listFor(cookie.v), listFor(username)]);
      const desired = decisionsToLink(visitorRecords, userRecords, currentCatalog);
      const linkedFrom = {};
      for (const [key, consentId] of Object.entries(decisionConsentIds(visitorRecords, currentCatalog))) {
        linkedFrom[key] = { linkedFrom: consentId };
      }
      await execute(username, planChanges(userRecords, currentCatalog, desired), currentCatalog, linkedFrom);
      // Nothing reads the visitor's consents once the browser is linked, so they must stop granting
      // anything. Only after the copy succeeded: a failed copy is retried on the next login.
      for (const record of visitorRecords.filter((r) => r.state === 'ACTIVE')) {
        try {
          await isClient.revokeConsent(record.id);
        } catch (e) {
          onError(e);
        }
      }
      return { v: cookie.v, u: username };
    },
  };
}

module.exports = { createCookieConsentService, StaleRevisionError };
