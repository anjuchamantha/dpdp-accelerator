/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 */
package org.wso2.dpdp.accelerator.event.notifications.dao.queries;

import org.testng.annotations.Test;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

public class QueryBuilderTest {

    @Test
    public void testSharedResultAndLikeUtility() {
        SubscriptionQueryBuilder subscriptionBuilder = new SubscriptionQueryBuilder("org1")
                .setSearch("a_%");
        QueryResult subscriptionResult = subscriptionBuilder.buildSelectQuery(null);
        QueryResult eventResult = new EventQueryBuilder("org1")
                .setSearch("a_%")
                .buildSelectQuery("SELECT 1 WHERE 1 = 1", null);

        assertTrue(subscriptionResult.getSql().contains("LIKE ?"));
        assertTrue(eventResult.getSql().contains("LIKE ?"));
        assertEquals(QueryBuilderUtils.escapeLikePattern("a_%"), "a!_!%");
        assertEquals(QueryBuilderUtils.buildCaseInsensitiveContainsPattern(" A_!% "), "%a!_!!!%%");
        assertEquals(QueryBuilderUtils.buildEscapedLikePredicate("LOWER(NAME)"),
                "LOWER(NAME) LIKE ? ESCAPE '!'");
    }

    @Test
    public void testTopicBuilderBuildsParameterizedQueries() {
        TopicQueryBuilder builder = new TopicQueryBuilder("org1")
                .setStatus("active")
                .setSearch("accounts")
                .setSort("-name");
        QueryResult result = builder.buildSelectQuery(" ORDER BY NAME DESC LIMIT ? OFFSET ?");

        assertTrue(result.getSql().contains("WHERE ORG_ID = ?"));
        assertTrue(result.getSql().contains("LOWER(STATUS) = LOWER(?)"));
        assertEquals(result.getParameters().size(), 5);
        assertEquals(builder.resolveSortColumn(), "NAME DESC");
    }

    @Test
    public void eventBuilderCoversEveryFilterAndEmptyVariants() {
        EventQueryBuilder full = new EventQueryBuilder("org")
                .setTopic(" Accounts ").setStatus(" DELIVERED ").setGroupId(" group ")
                .setSubscriptionId(" sub ").setPurposes("one, ,TWO").setSearch("a_%");
        QueryResult select = full.buildSelectQuery("SELECT * FROM EVENT e JOIN TOPIC t ON 1=1 WHERE e.ORG_ID = ?",
                " ORDER BY e.CREATED_AT DESC LIMIT ? OFFSET ?");
        QueryResult count = full.buildCountQuery("SELECT COUNT(*) FROM EVENT e JOIN TOPIC t ON 1=1 WHERE e.ORG_ID = ?");
        assertTrue(select.getSql().contains("WEBHOOK_DELIVERY"));
        assertTrue(select.getSql().contains("EVENT_PURPOSE"));
        assertEquals(select.getParameters(), count.getParameters());
        assertEquals(full.resolveSortColumn(), "e.CREATED_AT DESC");

        EventQueryBuilder empty = new EventQueryBuilder("org").setTopic("all").setStatus("all")
                .setGroupId(" ").setSubscriptionId(null).setPurposes(" , ").setSearch("");
        assertEquals(empty.buildCountQuery("SELECT 1 WHERE ORG_ID = ?").getParameters().size(), 1);
        empty.buildSelectQuery("SELECT 1 WHERE ORG_ID = ?", " ");
    }

    @Test
    public void eventBuilderCorrelatesSubscriptionAndStatusOnTheSameDelivery() {
        QueryResult result = new EventQueryBuilder("org")
                .setSubscriptionId(" sub-1 ")
                .setStatus(" FAILED ")
                .buildCountQuery("SELECT COUNT(*) FROM EVENT e WHERE e.ORG_ID = ?");

        assertTrue(result.getSql().contains("wd.SUBSCRIPTION_ID = ? AND LOWER(wd.STATUS) = ?"));
        assertTrue(result.getSql().contains("pd.SUBSCRIPTION_ID = ? AND LOWER(pd.STATUS) = ?"));
        assertEquals(result.getParameters(), java.util.Arrays.asList(
                "org", "sub-1", "failed", "sub-1", "failed"));
    }

    @Test
    public void postgresEventSearchCastsJsonPayloadToText() {
        QueryResult result = new EventQueryBuilder("org", new EventNotificationPostgresDBQueries())
                .setSearch("account")
                .buildCountQuery("SELECT COUNT(*) FROM EVENT e JOIN TOPIC t ON 1=1 WHERE e.ORG_ID = ?");

        assertTrue(result.getSql().contains("LOWER(CAST(e.PAYLOAD AS TEXT)) LIKE ? ESCAPE '!'"));
        assertTrue(!result.getSql().contains("LOWER(e.PAYLOAD) LIKE ?"));
    }

    @Test
    public void eventSearchIncludesWebhookAndPollDeliveryIds() {
        QueryResult result = new EventQueryBuilder("org")
                .setSearch("delivery-123")
                .buildCountQuery("SELECT COUNT(*) FROM EVENT e JOIN TOPIC t ON 1=1 WHERE e.ORG_ID = ?");

        assertTrue(result.getSql().contains("WEBHOOK_DELIVERY wd"));
        assertTrue(result.getSql().contains("LOWER(wd.DELIVERY_ID) LIKE ? ESCAPE '!'"));
        assertTrue(result.getSql().contains("POLL_DELIVERY pd"));
        assertTrue(result.getSql().contains("LOWER(pd.DELIVERY_ID) LIKE ? ESCAPE '!'"));
        assertEquals(result.getParameters().size(), 7);
    }

    @Test
    public void subscriptionBuilderCoversFiltersSortsAndEmptyInputs() {
        SubscriptionQueryBuilder full = new SubscriptionQueryBuilder("org").setStatus("active")
                .setSearch("a_%").setPurposes("one, ,TWO").setSort("updatedAt");
        assertTrue(full.buildSelectQuery(" LIMIT ? OFFSET ?").getSql().contains("SUBSCRIPTION_PURPOSE"));
        assertTrue(full.buildCountQuery().getParameters().size() > 3);
        assertTrue(full.resolveSortColumn().contains("UPDATED_AT ASC"));
        assertTrue(new SubscriptionQueryBuilder("org").setSort("createdAt").resolveSortColumn().contains("CREATED_AT ASC"));
        assertTrue(new SubscriptionQueryBuilder("org").setSort("-createdAt").resolveSortColumn().contains("CREATED_AT DESC"));
        assertTrue(new SubscriptionQueryBuilder("org").setSort("other").resolveSortColumn().contains("UPDATED_AT DESC"));
        new SubscriptionQueryBuilder("org").setStatus(" ").setSearch(null).setPurposes(" , ")
                .buildSelectQuery(null);
    }

    @Test
    public void subscriptionSearchIncludesWebhookPollDeliveryAndEventIds() {
        QueryResult result = new SubscriptionQueryBuilder("org")
                .setSearch("delivery-123")
                .buildCountQuery();

        assertTrue(result.getSql().contains("WEBHOOK_DELIVERY wd JOIN EVENT e"));
        assertTrue(result.getSql().contains("LOWER(wd.DELIVERY_ID) LIKE ? ESCAPE '!'"));
        assertTrue(result.getSql().contains("POLL_DELIVERY pd JOIN EVENT e"));
        assertTrue(result.getSql().contains("LOWER(pd.DELIVERY_ID) LIKE ? ESCAPE '!'"));
        assertTrue(result.getSql().contains("LOWER(e.EVENT_ID) LIKE ? ESCAPE '!'"));
        assertEquals(result.getParameters().size(), 11);
    }

    @Test
    public void topicBuilderCoversEverySortAndEmptyInput() {
        assertEquals(new TopicQueryBuilder("org").setSort("status").resolveSortColumn(), "STATUS ASC");
        assertEquals(new TopicQueryBuilder("org").setSort("-status").resolveSortColumn(), "STATUS DESC");
        assertEquals(new TopicQueryBuilder("org").setSort("name").resolveSortColumn(), "NAME ASC");
        TopicQueryBuilder empty = new TopicQueryBuilder("org").setStatus(" ").setSearch(null);
        assertEquals(empty.buildCountQuery().getParameters().size(), 1);
        empty.buildSelectQuery(null);
    }
}
