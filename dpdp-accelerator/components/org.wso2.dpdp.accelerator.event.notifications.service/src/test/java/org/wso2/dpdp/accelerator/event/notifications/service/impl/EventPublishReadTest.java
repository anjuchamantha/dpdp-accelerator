package org.wso2.dpdp.accelerator.event.notifications.service.impl;

import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryAckDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.EventDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.PaginatedDAOResult;
import org.wso2.dpdp.accelerator.event.notifications.dao.TopicDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.Event;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.SubscriptionDeliverySummary;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.WebhookDelivery;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.WebhookDeliveryAck;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.WebhookDeliveryAudit;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.Topic;
import org.wso2.dpdp.accelerator.event.notifications.service.dto.EventDTO;
import org.wso2.dpdp.accelerator.event.notifications.service.model.PaginatedResult;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNotNull;

public class EventPublishReadTest {

    private EventDAO eventDAO;
    private TopicDAO topicDAO;
    private DeliveryDAO deliveryDAO;
    private DeliveryAckDAO deliveryAckDAO;
    private EventPublishServiceImpl service;
    private Connection connection;

    @BeforeMethod
    public void setUp() throws Exception {
        connection = mock(Connection.class);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);
        setStaticInstance(null);
        setStaticDataSource(dataSource);

        eventDAO = mock(EventDAO.class);
        topicDAO = mock(TopicDAO.class);
        deliveryDAO = mock(DeliveryDAO.class);
        deliveryAckDAO = mock(DeliveryAckDAO.class);
        service = new EventPublishServiceImpl(eventDAO, topicDAO, deliveryDAO,
                deliveryAckDAO);
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

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void searchEventsRequiresOrganization() {
        service = new EventPublishServiceImpl();
        service.searchEvents(" ", null, 1, 0);
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void getEventRequiresId() {
        service.getEventById("org-1", " ");
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void getEventNotFoundIsReported() {
        when(eventDAO.getEventById(any(Connection.class), eq("missing"), eq("org-1"))).thenReturn(Optional.empty());
        service.getEventById("org-1", "missing");
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void getEventDeliveriesRequiresEventId() {
        service.getEventDeliveries("org-1", " ", 1, 0);
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void deliveryHistoryNotFoundIsReported() {
        when(deliveryDAO.getOrgDeliveryById(any(Connection.class), eq("org-1"), eq("missing"))).thenReturn(Optional.empty());
        service.getDeliveryHistory("org-1", "missing");
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void listOrgDeliveriesRequiresOrganization() {
        service.listOrgDeliveries(" ", null, null, null, null, null, 1, 0);
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void getEventRequiresOrganization() {
        service.getEventById(" ", "event");
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void getEventDeliveriesRequiresOrganization() {
        service.getEventDeliveries(" ", "event", 1, 0);
    }

    @Test(expectedExceptions = org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException.class)
    public void deliveryHistoryRequiresDeliveryId() {
        service.getDeliveryHistory("org-1", " ");
    }

    @Test
    public void searchEventsMapsResultsAndClampsPagination() {
        Event event = event("e1", "topic-1");
        when(eventDAO.searchEvents(any(Connection.class), eq("org-1"), eq("topic"), eq("active"), eq("group"), eq("p"), eq("s"),
                anyInt(), eq(0)))
                .thenReturn(new PaginatedDAOResult<>(Collections.singletonList(event), 4));
        PaginatedResult<?> result = service.searchEvents(" org-1 ", "topic", "active", "group", "p", "s", 99, -1);
        assertEquals(result.getTotal(), 4);
        assertEquals(result.getItems().size(), 1);
    }

    @Test
    public void listOrgDeliveriesMapsFallbackFields() {
        SubscriptionDeliverySummary summary = new SubscriptionDeliverySummary("d1", "e1", "s1", "g1",
                "topic", null, null, null, new Timestamp(100), null);
        when(deliveryDAO.listOrgDeliveries(any(Connection.class), eq("org-1"), nullable(String.class), nullable(String.class),
                nullable(String.class), nullable(String.class), nullable(String.class), anyInt(), eq(0),
                any(int[].class))).thenAnswer(invocation -> {
                    invocation.getArgument(9, int[].class)[0] = 2;
                    return Collections.singletonList(summary);
                });
        PaginatedResult<?> result = service.listOrgDeliveries("org-1", null, null, null, null, null, 0, -1);
        assertEquals(result.getTotal(), 2);
        assertEquals(result.getItems().size(), 1);
    }

    @Test
    public void webhookDeliveryHistoryMapsAckAndAudits() {
        SubscriptionDeliverySummary summary = new SubscriptionDeliverySummary("d1", "e1", "s1", "topic",
                "failed", "webhook", new Timestamp(100), null, null);
        when(deliveryDAO.getOrgDeliveryById(any(Connection.class), eq("org-1"), eq("d1"))).thenReturn(Optional.of(summary));
        when(deliveryDAO.getWebhookDeliveryById(any(Connection.class), eq("d1"), eq("org-1"))).thenReturn(Optional.of(
                new WebhookDelivery("d1", "s1", "e1", "failed", 1, new Timestamp(200), null, null, null)));
        when(deliveryAckDAO.getDeliveryAckByDeliveryId(any(Connection.class), eq("d1"))).thenReturn(Optional.of(
                new WebhookDeliveryAck("a", "d1", null, "completed", "evidence")));
        when(deliveryDAO.getWebhookDeliveryAudits(any(Connection.class), eq("d1"), eq("org-1"))).thenReturn(Arrays.asList(
                new WebhookDeliveryAudit("a1", "e1", "d1", "org-1", "200", null, new Timestamp(300)),
                new WebhookDeliveryAudit("a2", "e1", "d1", "org-1", "bad", null, null)));
        org.wso2.dpdp.accelerator.event.notifications.service.dto.SubscriptionEventHistoryDTO result =
                service.getDeliveryHistory("org-1", "d1");
        assertEquals(result.getCompletionStatus(), "completed");
        assertEquals(result.getHistory().size(), 2);
    }

    @Test
    public void pollDeliveryHistoryMapsCompletionAttempt() {
        SubscriptionDeliverySummary summary = new SubscriptionDeliverySummary("d1", "e1", "s1", "topic",
                "pending", "poll", null, new Timestamp(100), null);
        when(deliveryDAO.getOrgDeliveryById(any(Connection.class), eq("org-1"), eq("d1"))).thenReturn(Optional.of(summary));
        assertEquals(service.getDeliveryHistory("org-1", "d1").getHistory().size(), 1);
    }

    @Test
    public void getEventByIdAddsTopicAndDeliveryCount() {
        Event event = event("e1", "topic-1");
        when(eventDAO.getEventById(any(Connection.class), eq("e1"), eq("org-1"))).thenReturn(Optional.of(event));
        when(topicDAO.getTopicById(any(Connection.class), eq("topic-1"), eq("org-1"))).thenReturn(Optional.of(
                new Topic("topic-1", "org-1", "accounts", null, "active")));
        when(deliveryDAO.listEventDeliveries(any(Connection.class), eq("org-1"), eq("e1"), eq(1), eq(0), any(int[].class)))
                .thenAnswer(invocation -> {
                    invocation.getArgument(5, int[].class)[0] = 7;
                    return Collections.emptyList();
                });
        EventDTO result = service.getEventById(" org-1 ", " e1 ");
        assertEquals(result.getTopic(), "accounts");
        assertEquals(result.getDeliveriesCount(), 7);
    }

    @Test
    public void getEventDeliveriesNormalizesLimitAndOffset() {
        when(deliveryDAO.listEventDeliveries(any(Connection.class), eq("org-1"), eq("e1"), eq(1), eq(0), any(int[].class)))
                .thenReturn(Collections.emptyList());
        PaginatedResult<?> result = service.getEventDeliveries("org-1", "e1", 0, -4);
        assertNotNull(result);
        assertEquals(result.getItems().size(), 0);
    }

    private Event event(String id, String topicId) {
        Event event = new Event(id, "org-1", "group-1", topicId, "{}", new Timestamp(100));
        event.setPurposes(Collections.singletonList("billing"));
        return event;
    }
}
