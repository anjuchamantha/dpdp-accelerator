/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 * <p>
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 *     http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package org.wso2.dpdp.accelerator.event.notifications.dao.queries;

import org.wso2.dpdp.accelerator.event.notifications.dao.constants.EventNotificationDBColumns;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Helper builder for constructing dynamic event search and count queries.
 * Mirrors {@link SubscriptionQueryBuilder} while preserving event-level results
 * when delivery fields are used as search criteria.
 */
public class EventQueryBuilder {

    private final String orgId;
    private final EventNotificationCommonDBQueries queries;
    private String search;
    private String topic;
    private String status;
    private String groupId;
    private String subscriptionId;
    private String purposes;

    public EventQueryBuilder(String orgId) {
        this(orgId, new EventNotificationCommonDBQueries());
    }

    public EventQueryBuilder(String orgId, EventNotificationCommonDBQueries queries) {
        this.orgId = orgId;
        this.queries = queries;
    }

    public EventQueryBuilder setSearch(String search) {
        this.search = search;
        return this;
    }

    public EventQueryBuilder setTopic(String topic) {
        this.topic = topic;
        return this;
    }

    public EventQueryBuilder setStatus(String status) {
        this.status = status;
        return this;
    }

    public EventQueryBuilder setGroupId(String groupId) {
        this.groupId = groupId;
        return this;
    }

    public EventQueryBuilder setSubscriptionId(String subscriptionId) {
        this.subscriptionId = subscriptionId;
        return this;
    }

    public EventQueryBuilder setPurposes(String purposes) {
        this.purposes = purposes;
        return this;
    }

    /**
     * Fixed sort column for events. {@code createdAt} is the only timestamp
     * on the EVENT row today so a direction toggle is unnecessary.
     */
    public String resolveSortColumn() {
        return "e." + EventNotificationDBColumns.CREATED_AT + " DESC";
    }

    public QueryResult buildSelectQuery(String baseSelect, String paginationClause) {
        StringBuilder sql = new StringBuilder(baseSelect);
        List<Object> params = buildWhereClauseAndParams(sql);
        if (paginationClause != null && !paginationClause.trim().isEmpty()) {
            sql.append(paginationClause);
        }
        return new QueryResult(sql.toString(), params);
    }

    public QueryResult buildCountQuery(String countSelectBase) {
        StringBuilder sql = new StringBuilder(countSelectBase);
        List<Object> params = buildWhereClauseAndParams(sql);
        return new QueryResult(sql.toString(), params);
    }

    private List<Object> buildWhereClauseAndParams(StringBuilder sql) {
        List<Object> params = new ArrayList<>();
        params.add(orgId);

        if (topic != null && !topic.trim().isEmpty() && !"all".equalsIgnoreCase(topic.trim())) {
            sql.append(" AND LOWER(t.").append(EventNotificationDBColumns.NAME).append(") = ?");
            params.add(topic.trim().toLowerCase(Locale.ROOT));
        }

        if (groupId != null && !groupId.trim().isEmpty()) {
            sql.append(" AND e.").append(EventNotificationDBColumns.GROUP_ID).append(" = ?");
            params.add(groupId.trim());
        }

        boolean hasSubscriptionId = subscriptionId != null && !subscriptionId.trim().isEmpty();
        boolean hasStatus = status != null && !status.trim().isEmpty()
                && !"all".equalsIgnoreCase(status.trim());

        if (hasSubscriptionId && hasStatus) {
            String subscriptionParam = subscriptionId.trim();
            String statusParam = status.trim().toLowerCase(Locale.ROOT);
            sql.append(" AND (EXISTS (SELECT 1 FROM WEBHOOK_DELIVERY wd WHERE wd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND wd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = ? AND LOWER(wd.")
                    .append(EventNotificationDBColumns.STATUS).append(") = ?)")
                    .append(" OR EXISTS (SELECT 1 FROM POLL_DELIVERY pd WHERE pd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND pd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = ? AND LOWER(pd.")
                    .append(EventNotificationDBColumns.STATUS).append(") = ?))");
            params.add(subscriptionParam);
            params.add(statusParam);
            params.add(subscriptionParam);
            params.add(statusParam);
        } else if (hasSubscriptionId) {
            sql.append(" AND (EXISTS (SELECT 1 FROM WEBHOOK_DELIVERY wd WHERE wd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND wd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = ?)")
                    .append(" OR EXISTS (SELECT 1 FROM POLL_DELIVERY pd WHERE pd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND pd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = ?))");
            params.add(subscriptionId.trim());
            params.add(subscriptionId.trim());
        }

        if (hasStatus && !hasSubscriptionId) {
            sql.append(" AND (EXISTS (SELECT 1 FROM WEBHOOK_DELIVERY wd WHERE wd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND LOWER(wd.")
                    .append(EventNotificationDBColumns.STATUS).append(") = ?) OR EXISTS (SELECT 1 FROM POLL_DELIVERY pd WHERE pd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND LOWER(pd.")
                    .append(EventNotificationDBColumns.STATUS).append(") = ?))");
            String statusParam = status.trim().toLowerCase(Locale.ROOT);
            params.add(statusParam);
            params.add(statusParam);
        }

        if (purposes != null && !purposes.trim().isEmpty()) {
            String[] tokens = purposes.split(",");
            List<String> valid = new ArrayList<>();
            for (String token : tokens) {
                if (token != null && !token.trim().isEmpty()) {
                    valid.add(token.trim().toLowerCase(Locale.ROOT));
                }
            }
            if (!valid.isEmpty()) {
                sql.append(" AND e.").append(EventNotificationDBColumns.EVENT_ID)
                        .append(" IN (SELECT ep.").append(EventNotificationDBColumns.EVENT_ID)
                        .append(" FROM EVENT_PURPOSE ep WHERE LOWER(ep.")
                        .append(EventNotificationDBColumns.PURPOSE_NAME).append(") IN (");
                for (int i = 0; i < valid.size(); i++) {
                    sql.append(i == 0 ? "?" : ", ?");
                    params.add(valid.get(i));
                }
                sql.append("))");
            }
        }

        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(e." + EventNotificationDBColumns.EVENT_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(e." + EventNotificationDBColumns.GROUP_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(t." + EventNotificationDBColumns.NAME + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            queries.getEventPayloadSearchExpression()))
                    .append(" OR EXISTS (SELECT 1 FROM WEBHOOK_DELIVERY wd WHERE wd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND ")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(wd." + EventNotificationDBColumns.DELIVERY_ID + ")"))
                    .append(") OR EXISTS (SELECT 1 FROM POLL_DELIVERY pd WHERE pd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" AND ")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(pd." + EventNotificationDBColumns.DELIVERY_ID + ")"))
                    .append(")")
                    .append(")");
            String term = QueryBuilderUtils.buildCaseInsensitiveContainsPattern(search);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
        }
        return params;
    }

}
