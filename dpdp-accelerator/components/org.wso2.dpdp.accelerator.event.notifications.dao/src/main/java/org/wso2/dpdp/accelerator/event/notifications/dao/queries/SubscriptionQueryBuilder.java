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
 * Helper builder for constructing dynamic subscription search and count queries.
 */
public class SubscriptionQueryBuilder {

    private final String orgId;
    private String status;
    private String search;
    private String purposes;
    private String sort;

    public SubscriptionQueryBuilder(String orgId) {
        this.orgId = orgId;
    }

    public SubscriptionQueryBuilder setStatus(String status) {
        this.status = status;
        return this;
    }

    public SubscriptionQueryBuilder setSearch(String search) {
        this.search = search;
        return this;
    }

    public SubscriptionQueryBuilder setPurposes(String purposes) {
        this.purposes = purposes;
        return this;
    }

    public SubscriptionQueryBuilder setSort(String sort) {
        this.sort = sort;
        return this;
    }

    public String resolveSortColumn() {
        if ("updatedAt".equalsIgnoreCase(sort)) {
            return "s." + EventNotificationDBColumns.UPDATED_AT + " ASC";
        } else if ("createdAt".equalsIgnoreCase(sort)) {
            return "s." + EventNotificationDBColumns.CREATED_AT + " ASC";
        } else if ("-createdAt".equalsIgnoreCase(sort)) {
            return "s." + EventNotificationDBColumns.CREATED_AT + " DESC";
        } else {
            return "s." + EventNotificationDBColumns.UPDATED_AT + " DESC";
        }
    }

    public QueryResult buildSelectQuery(String paginationClause) {
        StringBuilder sql = new StringBuilder(
                "SELECT DISTINCT s." + EventNotificationDBColumns.SUBSCRIPTION_ID + ", s." +
                EventNotificationDBColumns.ORG_ID + ", s." + EventNotificationDBColumns.GROUP_ID + ", s." +
                EventNotificationDBColumns.TOPIC_ID + ", s." + EventNotificationDBColumns.PURPOSE_FILTER_MODE + ", s." +
                EventNotificationDBColumns.PURPOSE_SET_HASH + ", s." + EventNotificationDBColumns.DELIVERY_MODE +
                ", s." + EventNotificationDBColumns.CALLBACK_URL + ", s." + EventNotificationDBColumns.SHARED_SECRET +
                ", s." + EventNotificationDBColumns.STATUS + ", s." + EventNotificationDBColumns.CREATED_AT +
                ", s." + EventNotificationDBColumns.UPDATED_AT + " " +
                "FROM SUBSCRIPTION s " +
                "LEFT JOIN TOPIC t ON s." + EventNotificationDBColumns.TOPIC_ID + " = t." +
                EventNotificationDBColumns.TOPIC_ID + " " +
                "LEFT JOIN SUBSCRIPTION_PURPOSE sp ON s." + EventNotificationDBColumns.SUBSCRIPTION_ID +
                " = sp." + EventNotificationDBColumns.SUBSCRIPTION_ID + " " +
                "WHERE s." + EventNotificationDBColumns.ORG_ID + " = ?"
        );
        List<Object> params = buildWhereClauseAndParams(sql);
        if (paginationClause != null && !paginationClause.trim().isEmpty()) {
            sql.append(paginationClause);
        }
        return new QueryResult(sql.toString(), params);
    }

    public QueryResult buildCountQuery() {
        StringBuilder sql = new StringBuilder(
                "SELECT COUNT(DISTINCT s." + EventNotificationDBColumns.SUBSCRIPTION_ID + ") FROM SUBSCRIPTION s " +
                "LEFT JOIN TOPIC t ON s." + EventNotificationDBColumns.TOPIC_ID + " = t." +
                EventNotificationDBColumns.TOPIC_ID + " " +
                "LEFT JOIN SUBSCRIPTION_PURPOSE sp ON s." + EventNotificationDBColumns.SUBSCRIPTION_ID +
                " = sp." + EventNotificationDBColumns.SUBSCRIPTION_ID + " " +
                "WHERE s." + EventNotificationDBColumns.ORG_ID + " = ?"
        );
        List<Object> params = buildWhereClauseAndParams(sql);
        return new QueryResult(sql.toString(), params);
    }

    private List<Object> buildWhereClauseAndParams(StringBuilder sql) {
        List<Object> params = new ArrayList<>();
        params.add(orgId);

        if (status != null && !status.trim().isEmpty()) {
            sql.append(" AND s.").append(EventNotificationDBColumns.STATUS).append(" = ?");
            params.add(status.trim());
        }

        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(s." + EventNotificationDBColumns.SUBSCRIPTION_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(s." + EventNotificationDBColumns.GROUP_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(s." + EventNotificationDBColumns.STATUS + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(s." + EventNotificationDBColumns.CALLBACK_URL + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(t." + EventNotificationDBColumns.NAME + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(sp." + EventNotificationDBColumns.PURPOSE_NAME + ")"))
                    .append(" OR EXISTS (SELECT 1 FROM WEBHOOK_DELIVERY wd JOIN EVENT e ON e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = wd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" WHERE wd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = s.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" AND e.")
                    .append(EventNotificationDBColumns.ORG_ID).append(" = s.")
                    .append(EventNotificationDBColumns.ORG_ID).append(" AND (")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(wd." + EventNotificationDBColumns.DELIVERY_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(e." + EventNotificationDBColumns.EVENT_ID + ")"))
                    .append("))")
                    .append(" OR EXISTS (SELECT 1 FROM POLL_DELIVERY pd JOIN EVENT e ON e.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" = pd.")
                    .append(EventNotificationDBColumns.EVENT_ID).append(" WHERE pd.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = s.")
                    .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" AND e.")
                    .append(EventNotificationDBColumns.ORG_ID).append(" = s.")
                    .append(EventNotificationDBColumns.ORG_ID).append(" AND (")
                    .append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(pd." + EventNotificationDBColumns.DELIVERY_ID + ")"))
                    .append(" OR ").append(QueryBuilderUtils.buildEscapedLikePredicate(
                            "LOWER(e." + EventNotificationDBColumns.EVENT_ID + ")"))
                    .append("))")
                    .append(")");
            String term = QueryBuilderUtils.buildCaseInsensitiveContainsPattern(search);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
            params.add(term);
        }

        if (purposes != null && !purposes.trim().isEmpty()) {
            String[] purposeArr = purposes.split(",");
            List<String> validPurposes = new ArrayList<>();
            for (String p : purposeArr) {
                if (p != null && !p.trim().isEmpty()) {
                    validPurposes.add(p.trim().toLowerCase(Locale.ROOT));
                }
            }
            if (!validPurposes.isEmpty()) {
                sql.append(" AND EXISTS (SELECT 1 FROM SUBSCRIPTION_PURPOSE sp2 WHERE sp2.")
                        .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" = s.")
                        .append(EventNotificationDBColumns.SUBSCRIPTION_ID).append(" AND LOWER(sp2.")
                        .append(EventNotificationDBColumns.PURPOSE_NAME).append(") IN (");
                for (int i = 0; i < validPurposes.size(); i++) {
                    sql.append(i == 0 ? "?" : ", ?");
                }
                sql.append("))");
                params.addAll(validPurposes);
            }
        }
        return params;
    }

}
