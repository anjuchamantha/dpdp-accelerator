/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 */
package org.wso2.dpdp.accelerator.event.notifications.service.recovery;

import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.common.config.DPDPConfigurationService;
import org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.SubscriptionDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.Subscription;
import org.wso2.dpdp.accelerator.event.notifications.service.SubscriptionService;

import javax.sql.DataSource;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.Collections;
import java.util.concurrent.ThreadPoolExecutor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;
import static org.testng.Assert.expectThrows;

public class DeliveryRecoveryServiceTest {

    @Mock
    private SubscriptionDAO subscriptionDAO;
    @Mock
    private DeliveryDAO deliveryDAO;
    @Mock
    private SubscriptionService subscriptionService;
    @Mock
    private DPDPConfigurationService configurationService;

    private DeliveryRecoveryService recoveryService;
    private Connection connection;

    @BeforeMethod
    public void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        connection = mock(Connection.class);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);
        setStaticInstance(null);
        setStaticDataSource(dataSource);

        when(configurationService.getEventNotificationThreadPoolSize()).thenReturn(2);
        when(configurationService.getEventNotificationDeliveryWorkerPollSeconds()).thenReturn(5);
        when(configurationService.getEventNotificationDeliveryWorkerBatchSize()).thenReturn(20);
        when(configurationService.getEventNotificationStuckInFlightThresholdSeconds()).thenReturn(10);
        when(configurationService.getEventNotificationPendingSubscriptionRecoveryThresholdSeconds())
                .thenReturn(60);
        when(configurationService.getEventNotificationBackgroundWorkerInitialDelaySeconds()).thenReturn(10);
        when(configurationService.getEventNotificationPendingSubscriptionRecoveryIntervalSeconds()).thenReturn(30);
        when(configurationService.getEventNotificationPendingSubscriptionRecoveryBatchSize()).thenReturn(20);
        when(configurationService.getEventNotificationWorkerShutdownTimeoutSeconds()).thenReturn(5);
        recoveryService = new DeliveryRecoveryService(subscriptionDAO, deliveryDAO,
                subscriptionService, configurationService);
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
    public void pendingSubscriptionsWithCallbacksAreRetried() throws Exception {
        Subscription retryable = subscription("retryable", "https://example.com:443/callback");
        Subscription withoutCallback = subscription("without-callback", " ");
        when(subscriptionDAO.getPendingSubscriptionsForRecovery(any(Connection.class), any(Timestamp.class), anyInt()))
                .thenReturn(Arrays.asList(retryable, withoutCallback));
        runPendingRecoveryTask();

        verify(subscriptionService).retryVerification("org1", "retryable");
    }

    @Test
    public void retryFailureDoesNotAbortOtherRecoveryRuns() throws Exception {
        Subscription retryable = subscription("retryable", "https://example.com:443/callback");
        when(subscriptionDAO.getPendingSubscriptionsForRecovery(any(Connection.class), any(Timestamp.class), anyInt()))
                .thenReturn(Collections.singletonList(retryable));
        doThrow(new RuntimeException("verification unavailable"))
                .when(subscriptionService).retryVerification("org1", "retryable");

        runPendingRecoveryTask();

        verify(subscriptionService).retryVerification("org1", "retryable");
    }

    @Test
    public void recoveryDelegatesClaimOwnershipToSubscriptionService() throws Exception {
        Subscription retryable = subscription("already-claimed", "https://example.com:443/callback");
        when(subscriptionDAO.getPendingSubscriptionsForRecovery(any(Connection.class), any(Timestamp.class), anyInt()))
                .thenReturn(Collections.singletonList(retryable));

        runPendingRecoveryTask();

        verify(subscriptionService).retryVerification("org1", "already-claimed");
    }

    @Test
    public void serviceCanActivateAndDeactivate() {
        recoveryService.activate();
        recoveryService.deactivate();
        recoveryService.deactivate();
    }

    @Test
    public void workerExecutorQueueIsBoundedByConfiguredBatchSize() throws Exception {
        recoveryService.activate();
        try {
            Field workerPoolField = DeliveryRecoveryService.class.getDeclaredField("workerPool");
            workerPoolField.setAccessible(true);
            ThreadPoolExecutor workerPool = (ThreadPoolExecutor) workerPoolField.get(recoveryService);

            assertEquals(workerPool.getCorePoolSize(), 2);
            assertEquals(workerPool.getQueue().remainingCapacity(), 20);
        } finally {
            recoveryService.deactivate();
        }
    }

    @Test
    public void activationRejectsStuckThresholdAtHttpTimeout() {
        when(configurationService.getEventNotificationStuckInFlightThresholdSeconds()).thenReturn(5);

        IllegalStateException error = expectThrows(IllegalStateException.class, recoveryService::activate);

        assertTrue(error.getMessage().contains("must be greater than 5 seconds"));
    }

    @Test
    public void activationRejectsVerificationRecoveryThresholdAtHttpTimeout() {
        when(configurationService.getEventNotificationPendingSubscriptionRecoveryThresholdSeconds()).thenReturn(5);

        IllegalStateException error = expectThrows(IllegalStateException.class, recoveryService::activate);

        assertTrue(error.getMessage().contains("pending subscription recovery threshold"));
    }

    private void runPendingRecoveryTask() throws Exception {
        Class<?> taskClass = Arrays.stream(DeliveryRecoveryService.class.getDeclaredClasses())
                .filter(clazz -> clazz.getSimpleName().equals("PendingDeliveryRecoveryTask"))
                .findFirst()
                .orElseThrow();
        Constructor<?> constructor = taskClass.getDeclaredConstructor(DeliveryRecoveryService.class);
        constructor.setAccessible(true);
        Runnable task = (Runnable) constructor.newInstance(recoveryService);
        task.run();
    }

    private Subscription subscription(String id, String callbackUrl) {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        return new Subscription(id, "org1", "group1", "topic1", "ALL", Collections.emptyList(),
                "WEBHOOK", callbackUrl, "secret", "PENDING", now, now);
    }
}
