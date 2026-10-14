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

const DECIDED_STATES = new Set(['ACTIVE', 'REJECTED', 'REVOKED']);

function recordsForCategory(records, category) {
  return records
    .filter((r) => (r.purposes || []).some((p) => p.id === category.purposeId))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function isCurrentVersion(record, category) {
  return (record.purposes || []).some((p) => p.id === category.purposeId && p.versionId === category.versionId);
}

/** {accepted, timestamp, consentId} for the category's current purpose version, or null if undecided. */
function currentDecision(records, category) {
  const latest = recordsForCategory(records, category)[0];
  if (!latest || !DECIDED_STATES.has(latest.state) || !isCurrentVersion(latest, category)) return null;
  return { accepted: latest.state === 'ACTIVE', timestamp: latest.timestamp, consentId: latest.id };
}

function resolveState(records, catalog) {
  const categories = {};
  let hasDecision = true;
  for (const category of catalog.categories) {
    const decision = currentDecision(records, category);
    if (decision) categories[category.key] = decision.accepted;
    else hasDecision = false;
  }
  return { revision: catalog.revision, hasDecision, categories };
}

/**
 * Declining an accepted category is a revoke; declining an undecided one is a REJECTED consent,
 * so a refusal is on record too. Every ACTIVE consent of a changed category is revoked, older
 * purpose versions included, so a subject never holds two live consents for one category.
 */
function planChanges(records, catalog, desired) {
  const ops = [];
  for (const category of catalog.categories) {
    const want = desired[category.key];
    if (typeof want !== 'boolean') continue;
    const decision = currentDecision(records, category);
    if (decision && decision.accepted === want) continue;
    const active = recordsForCategory(records, category).filter((r) => r.state === 'ACTIVE');
    for (const record of active) ops.push({ op: 'revoke', category: category.key, consentId: record.id });
    if (want) {
      ops.push({ op: 'create', category: category.key, state: 'ACTIVE' });
    } else if (!active.some((r) => isCurrentVersion(r, category))) {
      ops.push({ op: 'create', category: category.key, state: 'REJECTED' });
    }
  }
  return ops;
}

function decisionsToLink(visitorRecords, userRecords, catalog) {
  const desired = {};
  for (const category of catalog.categories) {
    const visitor = currentDecision(visitorRecords, category);
    if (!visitor) continue;
    const user = currentDecision(userRecords, category);
    if (!user || visitor.timestamp > user.timestamp) desired[category.key] = visitor.accepted;
  }
  return desired;
}

/** Category key -> ID of the consent holding the current decision, for categories that have one. */
function decisionConsentIds(records, catalog) {
  const ids = {};
  for (const category of catalog.categories) {
    const decision = currentDecision(records, category);
    if (decision) ids[category.key] = decision.consentId;
  }
  return ids;
}

module.exports = { resolveState, planChanges, decisionsToLink, decisionConsentIds };
