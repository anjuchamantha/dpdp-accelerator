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

package org.wso2.dpdp.accelerator.event.notifications.service.impl;

import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.common.config.DPDPConfigurationService;
import org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryAckDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.EventDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.SubscriptionDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.TopicDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.PollDelivery;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.Subscription;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.SubscriptionDeliverySummary;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.WebhookDeliveryAudit;
import org.wso2.dpdp.accelerator.event.notifications.service.dto.SubscriptionDeliveryAttemptDTO;
import org.wso2.dpdp.accelerator.event.notifications.service.dto.SubscriptionEventHistoryDTO;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.testng.Assert.assertEquals;

public class DeliveryHistoryConsistencyTest {

    private static final String ORG_ID = "org-1";
    private static final String SUBSCRIPTION_ID = "sub-1";
    private static final String DELIVERY_ID = "delivery-1";

    private DeliveryDAO deliveryDAO;
    private DeliveryAckDAO deliveryAckDAO;
    private EventPublishServiceImpl eventService;
    private SubscriptionServiceImpl subscriptionService;
    private Connection connection;

    @BeforeMethod
    public void setUp() throws Exception {
        connection = mock(Connection.class);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);
        setStaticInstance(null);
        setStaticDataSource(dataSource);

        EventDAO eventDAO = mock(EventDAO.class);
        TopicDAO topicDAO = mock(TopicDAO.class);
        SubscriptionDAO subscriptionDAO = mock(SubscriptionDAO.class);
        deliveryDAO = mock(DeliveryDAO.class);
        deliveryAckDAO = mock(DeliveryAckDAO.class);

        eventService = new EventPublishServiceImpl(eventDAO, topicDAO, deliveryDAO,
                deliveryAckDAO);
        subscriptionService = new SubscriptionServiceImpl(subscriptionDAO, topicDAO, deliveryDAO, deliveryAckDAO,
                mock(DPDPConfigurationService.class));
        when(subscriptionDAO.getSubscriptionById(any(Connection.class), eq(SUBSCRIPTION_ID), eq(ORG_ID))).thenReturn(Optional.of(
                new Subscription(SUBSCRIPTION_ID, ORG_ID, ORG_ID, "topic-1", "all",
                        Collections.emptyList(), "webhook", null, null, "active", null, null)));
    }

    @AfterMethod
    public void tearDown() throws Exception {
        setStaticDataSource(null);
        setStaticInstance(null);
    }

    private static void setStaticDataSource(DataSource dataSource) throws Exception {
        Field field = JDBCPersistenceManager.class.getDeclaredField("dataSource");
        field.setAccessible(true);
        field.set(null, dataSource);
    }

    private static void setStaticInstance(JDBCPersistenceManager instance) throws Exception {
        Field field = JDBCPersistenceManager.class.getDeclaredField("instance");
        field.setAccessible(true);
        field.set(null, instance);
    }

    @Test
    public void webhookHistoryIsIdenticalAcrossServiceEntryPoints() {
        SubscriptionDeliverySummary summary = summary("failed", "webhook");
        prepareSummary(summary);
        when(deliveryDAO.getWebhookDeliveryById(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Optional.empty());
        when(deliveryAckDAO.getDeliveryAckByDeliveryId(any(Connection.class), eq(DELIVERY_ID))).thenReturn(Optional.empty());
        when(deliveryDAO.getWebhookDeliveryAudits(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Arrays.asList(
                new WebhookDeliveryAudit("a1", "event-1", DELIVERY_ID, ORG_ID, " 200 ",
                        new Timestamp(100), new Timestamp(200)),
                new WebhookDeliveryAudit("a2", "event-1", DELIVERY_ID, ORG_ID, "500",
                        new Timestamp(300), null)));

        assertEquivalent(eventService.getDeliveryHistory(ORG_ID, DELIVERY_ID),
                subscriptionService.getSubscriptionEventHistory(ORG_ID, SUBSCRIPTION_ID, DELIVERY_ID));
    }

    @Test
    public void pollHistoryIsIdenticalAcrossServiceEntryPoints() {
        SubscriptionDeliverySummary summary = summary("acknowledged", "poll");
        prepareSummary(summary);
        when(deliveryDAO.getPollDeliveryById(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Optional.of(
                new PollDelivery(DELIVERY_ID, SUBSCRIPTION_ID, "event-1", "acknowledged",
                        new Timestamp(100), new Timestamp(500))));

        assertEquivalent(eventService.getDeliveryHistory(ORG_ID, DELIVERY_ID),
                subscriptionService.getSubscriptionEventHistory(ORG_ID, SUBSCRIPTION_ID, DELIVERY_ID));
    }

    @Test
    public void missingDeliveryStatusUsesModeSpecificPendingStatus() {
        SubscriptionDeliverySummary webhook = summary(null, "webhook");
        prepareSummary(webhook);
        when(deliveryDAO.getWebhookDeliveryById(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Optional.empty());
        when(deliveryAckDAO.getDeliveryAckByDeliveryId(any(Connection.class), eq(DELIVERY_ID))).thenReturn(Optional.empty());
        when(deliveryDAO.getWebhookDeliveryAudits(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Collections.emptyList());

        assertEquals(eventService.getDeliveryHistory(ORG_ID, DELIVERY_ID).getCurrentStatus(), "pending");

        SubscriptionDeliverySummary poll = summary(null, "poll");
        prepareSummary(poll);
        when(deliveryDAO.getPollDeliveryById(any(Connection.class), eq(DELIVERY_ID), eq(ORG_ID))).thenReturn(Optional.empty());

        SubscriptionEventHistoryDTO pollResult = eventService.getDeliveryHistory(ORG_ID, DELIVERY_ID);
        assertEquals(pollResult.getCurrentStatus(), "pending");
        assertEquals(pollResult.getCompletionStatus(), "pending");
    }

    private void prepareSummary(SubscriptionDeliverySummary summary) {
        when(deliveryDAO.getOrgDeliveryById(any(Connection.class), eq(ORG_ID), eq(DELIVERY_ID))).thenReturn(Optional.of(summary));
        when(deliveryDAO.getSubscriptionDeliveryById(any(Connection.class), eq(ORG_ID), eq(SUBSCRIPTION_ID), eq(DELIVERY_ID)))
                .thenReturn(Optional.of(summary));
    }

    private SubscriptionDeliverySummary summary(String status, String mode) {
        return new SubscriptionDeliverySummary(DELIVERY_ID, "event-1", SUBSCRIPTION_ID, "topic-1", status, mode,
                new Timestamp(100), new Timestamp(50), null);
    }

    private void assertEquivalent(SubscriptionEventHistoryDTO eventResult,
            SubscriptionEventHistoryDTO subscriptionResult) {
        assertEquals(eventResult.getDeliveryId(), subscriptionResult.getDeliveryId());
        assertEquals(eventResult.getEventId(), subscriptionResult.getEventId());
        assertEquals(eventResult.getTopic(), subscriptionResult.getTopic());
        assertEquals(eventResult.getDeliveryMode(), subscriptionResult.getDeliveryMode());
        assertEquals(eventResult.getCurrentStatus(), subscriptionResult.getCurrentStatus());
        assertEquals(eventResult.getOccurredAt(), subscriptionResult.getOccurredAt());
        assertEquals(eventResult.getCompletionStatus(), subscriptionResult.getCompletionStatus());
        assertEquals(eventResult.getCompletionEvidence(), subscriptionResult.getCompletionEvidence());
        assertEquals(eventResult.getNextRetryAt(), subscriptionResult.getNextRetryAt());
        assertEquals(eventResult.getHistory().size(), subscriptionResult.getHistory().size());
        for (int index = 0; index < eventResult.getHistory().size(); index++) {
            SubscriptionDeliveryAttemptDTO eventAttempt = eventResult.getHistory().get(index);
            SubscriptionDeliveryAttemptDTO subscriptionAttempt = subscriptionResult.getHistory().get(index);
            assertEquals(eventAttempt.getAttempt(), subscriptionAttempt.getAttempt());
            assertEquals(eventAttempt.getStatus(), subscriptionAttempt.getStatus());
            assertEquals(eventAttempt.getTimestamp(), subscriptionAttempt.getTimestamp());
            assertEquals(eventAttempt.getHttpStatus(), subscriptionAttempt.getHttpStatus());
            assertEquals(eventAttempt.getError(), subscriptionAttempt.getError());
        }
    }
}
