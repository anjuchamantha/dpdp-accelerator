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

import org.testng.annotations.Test;

import java.util.List;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;

public class SubscriptionQueryBuilderTest {

    @Test
    public void testBaseSelectQueryAndCountQuery() {
        SubscriptionQueryBuilder builder = new SubscriptionQueryBuilder("org123");

        QueryResult selectResult = builder.buildSelectQuery(" ORDER BY s.UPDATED_AT DESC");
        QueryResult countResult = builder.buildCountQuery();

        assertTrue(selectResult.getSql().contains("WHERE s.ORG_ID = ?"));
        assertTrue(selectResult.getSql().contains("ORDER BY s.UPDATED_AT DESC"));
        assertEquals(selectResult.getParameters().size(), 1);
        assertEquals(selectResult.getParameters().get(0), "org123");

        assertTrue(countResult.getSql().startsWith("SELECT COUNT(DISTINCT s.SUBSCRIPTION_ID)"));
        assertTrue(countResult.getSql().contains("WHERE s.ORG_ID = ?"));
        assertEquals(countResult.getParameters().size(), 1);
        assertEquals(countResult.getParameters().get(0), "org123");
    }

    @Test
    public void testStatusFilter() {
        SubscriptionQueryBuilder builder = new SubscriptionQueryBuilder("org123")
                .setStatus("active");

        QueryResult selectResult = builder.buildSelectQuery(null);

        assertTrue(selectResult.getSql().contains("AND s.STATUS = ?"));
        assertEquals(selectResult.getParameters().size(), 2);
        assertEquals(selectResult.getParameters().get(0), "org123");
        assertEquals(selectResult.getParameters().get(1), "active");
    }

    @Test
    public void testSearchFilterAndLikeEscaping() {
        SubscriptionQueryBuilder builder = new SubscriptionQueryBuilder("org123")
                .setSearch("test_user%name\\foo");

        QueryResult selectResult = builder.buildSelectQuery(null);

        assertTrue(selectResult.getSql().contains("LOWER(s.SUBSCRIPTION_ID) LIKE ? ESCAPE '!'"));
        assertTrue(selectResult.getSql().contains("LOWER(s.GROUP_ID) LIKE ? ESCAPE '!'"));
        assertTrue(selectResult.getSql().contains("LOWER(sp.PURPOSE_NAME) LIKE ? ESCAPE '!'"));
        
        // 1 orgId parameter + 10 LIKE parameters (subscription fields plus
        // webhook/poll delivery and associated event IDs).
        List<Object> params = selectResult.getParameters();
        assertEquals(params.size(), 11);
        assertEquals(params.get(0), "org123");
        assertEquals(params.get(1), "%test!_user!%name\\foo%");
    }

    @Test
    public void testSearchBySubscriptionId() {
        String subId = "6a37566c-26e2-4ae9-b070-e6733271b0ce";
        SubscriptionQueryBuilder builder = new SubscriptionQueryBuilder("org123")
                .setSearch(subId);

        QueryResult selectResult = builder.buildSelectQuery(null);

        assertTrue(selectResult.getSql().contains("LOWER(s.SUBSCRIPTION_ID) LIKE ?"));
        List<Object> params = selectResult.getParameters();
        assertEquals(params.size(), 11);
        assertEquals(params.get(0), "org123");
        assertEquals(params.get(1), "%" + subId.toLowerCase() + "%");
    }

    @Test
    public void testLikePatternEscapingHelper() {
        assertEquals(QueryBuilderUtils.escapeLikePattern(null), "");
        assertEquals(QueryBuilderUtils.escapeLikePattern("normal"), "normal");
        assertEquals(QueryBuilderUtils.escapeLikePattern("100%_pure\\"), "100!%!_pure\\");
        assertEquals(QueryBuilderUtils.escapeLikePattern("important!"), "important!!");
    }

    @Test
    public void testPurposesFilterSingleAndMultiple() {
        // Single purpose
        SubscriptionQueryBuilder singleBuilder = new SubscriptionQueryBuilder("org123")
                .setPurposes("marketing");
        QueryResult singleResult = singleBuilder.buildSelectQuery(null);
        assertTrue(singleResult.getSql().contains("LOWER(sp2.PURPOSE_NAME) IN (?)"));
        assertEquals(singleResult.getParameters().get(1), "marketing");

        // Multiple comma-separated purposes with spaces
        SubscriptionQueryBuilder multiBuilder = new SubscriptionQueryBuilder("org123")
                .setPurposes(" Marketing , Analytics, PROFILING ");
        QueryResult multiResult = multiBuilder.buildSelectQuery(null);
        assertTrue(multiResult.getSql().contains("LOWER(sp2.PURPOSE_NAME) IN (?, ?, ?)"));
        assertEquals(multiResult.getParameters().size(), 4);
        assertEquals(multiResult.getParameters().get(1), "marketing");
        assertEquals(multiResult.getParameters().get(2), "analytics");
        assertEquals(multiResult.getParameters().get(3), "profiling");

        // Empty / blank purposes
        SubscriptionQueryBuilder emptyBuilder = new SubscriptionQueryBuilder("org123")
                .setPurposes("  ,  ");
        QueryResult emptyResult = emptyBuilder.buildSelectQuery(null);
        assertFalse(emptyResult.getSql().contains("SUBSCRIPTION_PURPOSE sp2"));
        assertEquals(emptyResult.getParameters().size(), 1);
    }

    @Test
    public void testSortColumnResolution() {
        assertEquals(new SubscriptionQueryBuilder("org").setSort("updatedAt").resolveSortColumn(), "s.UPDATED_AT ASC");
        assertEquals(new SubscriptionQueryBuilder("org").setSort("createdAt").resolveSortColumn(), "s.CREATED_AT ASC");
        assertEquals(new SubscriptionQueryBuilder("org").setSort("-createdAt").resolveSortColumn(), "s.CREATED_AT DESC");
        assertEquals(new SubscriptionQueryBuilder("org").setSort("invalid").resolveSortColumn(), "s.UPDATED_AT DESC");
        assertEquals(new SubscriptionQueryBuilder("org").setSort(null).resolveSortColumn(), "s.UPDATED_AT DESC");
    }

    @Test
    public void testCombinedFilters() {
        SubscriptionQueryBuilder builder = new SubscriptionQueryBuilder("org123")
                .setStatus("active")
                .setSearch("callback")
                .setPurposes("marketing, analytics")
                .setSort("-createdAt");

        String sortColumn = builder.resolveSortColumn();
        assertEquals(sortColumn, "s.CREATED_AT DESC");

        QueryResult result = builder.buildSelectQuery(" ORDER BY " + sortColumn);

        assertTrue(result.getSql().contains("AND s.STATUS = ?"));
        assertTrue(result.getSql().contains("LIKE ?"));
        assertTrue(result.getSql().contains("IN (?, ?)"));
        assertTrue(result.getSql().contains("ORDER BY s.CREATED_AT DESC"));

        List<Object> params = result.getParameters();
        // orgId (1) + status (1) + search (10) + purposes (2) = 14 params
        assertEquals(params.size(), 14);
        assertEquals(params.get(0), "org123");
        assertEquals(params.get(1), "active");
        assertEquals(params.get(2), "%callback%");
        assertEquals(params.get(12), "marketing");
        assertEquals(params.get(13), "analytics");
    }
}
