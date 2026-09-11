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

package org.wso2.dpdp.accelerator.event.notifications.service.dispatch;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.event.notifications.dao.DeliveryDAO;
import org.wso2.dpdp.accelerator.common.config.DPDPConfigurationService;
import java.net.http.HttpClient;
import java.sql.Connection;
import java.sql.Timestamp;
import java.util.Collections;
import java.util.concurrent.ScheduledExecutorService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

public class WebhookDeliveryWorkerStuckRecoveryTest {

        @Mock
        private DeliveryDAO deliveryDAO;

        @Mock
        private ScheduledExecutorService scheduler;

        @Mock
        private HttpClient httpClient;

        @Mock
        private DPDPConfigurationService configurationService;

        @Mock
        private Connection connection;

        private WebhookDeliveryWorker worker;

        @BeforeMethod
        public void setUp() throws Exception {
                MockitoAnnotations.openMocks(this);
                javax.sql.DataSource dataSource = org.mockito.Mockito.mock(javax.sql.DataSource.class);
                when(dataSource.getConnection()).thenReturn(connection);
                setStaticInstance(null);
                setStaticDataSource(dataSource);
                when(configurationService.getEventNotificationDeliveryWorkerBatchSize()).thenReturn(50);
                when(configurationService.getEventNotificationStuckInFlightThresholdSeconds()).thenReturn(10);
                worker = new WebhookDeliveryWorker(deliveryDAO, scheduler, httpClient, configurationService);
        }

        @org.testng.annotations.AfterMethod
        public void tearDown() throws Exception {
                setStaticDataSource(null);
                setStaticInstance(null);
        }

        private static void setStaticDataSource(javax.sql.DataSource dataSource) throws Exception {
                java.lang.reflect.Field field = org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager.class
                                .getDeclaredField("dataSource");
                field.setAccessible(true);
                field.set(null, dataSource);
        }

        private static void setStaticInstance(
                        org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager instance) throws Exception {
                java.lang.reflect.Field field = org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager.class
                                .getDeclaredField("instance");
                field.setAccessible(true);
                field.set(null, instance);
        }

        @Test
        public void testStuckRecoveryPassAppliesTimestampCutoff() {
                when(deliveryDAO.getPendingWebhookDispatchContexts(any(Connection.class), any(Integer.class)))
                                .thenReturn(Collections.emptyList());
                when(deliveryDAO.getStuckInFlightWebhookDispatchContexts(any(Connection.class), any(Integer.class),
                                any(Timestamp.class)))
                                .thenReturn(Collections.emptyList());

                int[] result = worker.runTick();

                assertEquals(result[0], 0);
                assertEquals(result[1], 0);

                ArgumentCaptor<Timestamp> cutoffCaptor = ArgumentCaptor.forClass(Timestamp.class);
                verify(deliveryDAO).getStuckInFlightWebhookDispatchContexts(any(Connection.class), anyInt(),
                                cutoffCaptor.capture());

                Timestamp cutoff = cutoffCaptor.getValue();
                long thresholdMs = configurationService.getEventNotificationStuckInFlightThresholdSeconds() * 1000L;
                assertTrue(cutoff.getTime() <= System.currentTimeMillis() - (thresholdMs - 2000L),
                                "Cutoff timestamp should be past the stuck threshold");
        }
}
