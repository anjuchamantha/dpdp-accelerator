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

import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.common.persistence.JDBCPersistenceManager;
import org.wso2.dpdp.accelerator.event.notifications.common.enums.TopicStatus;
import org.wso2.dpdp.accelerator.event.notifications.dao.TopicDAO;
import org.wso2.dpdp.accelerator.event.notifications.dao.model.Topic;
import org.wso2.dpdp.accelerator.event.notifications.service.dto.TopicDTO;
import org.wso2.dpdp.accelerator.event.notifications.service.exception.EventNotificationException;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNotEquals;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.fail;

public class TopicConcurrencyAndHistoryTest {

    @Mock
    private TopicDAO topicDAO;

    private TopicServiceImpl topicService;
    private Connection connection;

    @BeforeMethod
    public void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        connection = mock(Connection.class);
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenReturn(connection);
        setStaticInstance(null);
        setStaticDataSource(dataSource);
        topicService = new TopicServiceImpl(topicDAO);
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
    public void testRecreatingDeregisteredTopicGeneratesNewTopicId() {
        String orgId = "org-1";
        String topicName = "consent.update";

        // Active lookup returns empty because existing topic with same name was
        // deregistered
        when(topicDAO.getTopicByOrgAndName(any(Connection.class), eq(orgId), eq(topicName))).thenReturn(Optional.empty());
        when(topicDAO.addTopic(any(Connection.class), any(Topic.class))).thenReturn(true);

        TopicDTO createdTopic = topicService.createTopic(orgId, topicName, "Description for new topic");

        assertNotNull(createdTopic);
        assertNotNull(createdTopic.getTopicId());
        assertNotEquals(createdTopic.getTopicId(), "old-uuid-123");
        assertEquals(createdTopic.getName(), topicName);
        assertEquals(createdTopic.getStatus(), TopicStatus.ACTIVE.getValue());
        verify(topicDAO).addTopic(any(Connection.class), any(Topic.class));
    }

    @Test
    public void testCreatingDuplicateActiveTopicFailsWith409() {
        String orgId = "org-1";
        String topicName = "consent.update";
        Topic activeTopic = new Topic("old-uuid-123", orgId, topicName, "existing", TopicStatus.ACTIVE.getValue());

        when(topicDAO.getTopicByOrgAndName(any(Connection.class), eq(orgId), eq(topicName))).thenReturn(Optional.of(activeTopic));

        try {
            topicService.createTopic(orgId, topicName, "Duplicate topic test");
            fail("Expected 409 conflict exception");
        } catch (EventNotificationException e) {
            assertEquals(e.getStatusCode(), 409);
        }
    }
}
