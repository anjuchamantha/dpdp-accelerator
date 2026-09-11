/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 */
package org.wso2.dpdp.accelerator.common.persistence;

import org.mockito.Mockito;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;
import org.wso2.dpdp.accelerator.common.exception.DPDPCommonRuntimeException;

import javax.sql.DataSource;
import java.lang.reflect.Field;
import java.sql.Connection;
import java.sql.SQLException;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertSame;
import static org.testng.Assert.expectThrows;

/**
 * {@code dataSource} and {@code instance} are both process-wide static singletons on
 * {@link JDBCPersistenceManager}, so every test resets both - a mock datasource is pre-set
 * before each test (letting {@code getInstance()} construct successfully without a real JNDI
 * context), and the one test that exercises the JNDI-failure path clears it again first.
 */
public class JDBCPersistenceManagerTest {

    private DataSource dataSource;

    @BeforeMethod
    public void setUpDefaultDataSource() throws Exception {
        dataSource = Mockito.mock(DataSource.class);
        setStaticDataSource(dataSource);
    }

    @AfterMethod
    public void tearDown() throws Exception {
        setStaticDataSource(null);
        setStaticInstance(null);
    }

    @Test
    public void getInstanceReturnsTheSameSingleton() {

        assertSame(JDBCPersistenceManager.getInstance(), JDBCPersistenceManager.getInstance());
    }

    @Test
    public void getDBConnectionDisablesAutoCommitAndReturnsTheConnection() throws Exception {

        Connection connection = Mockito.mock(Connection.class);
        Mockito.when(dataSource.getConnection()).thenReturn(connection);

        Connection returned = JDBCPersistenceManager.getInstance().getDBConnection();

        assertSame(returned, connection);
        Mockito.verify(connection).setAutoCommit(false);
    }

    @Test
    public void getDBConnectionWrapsFailureWhenDatasourceIsUnavailable() throws Exception {

        setStaticDataSource(null);
        setStaticInstance(null);

        expectThrows(DPDPCommonRuntimeException.class, JDBCPersistenceManager::getInstance);
    }

    @Test
    public void getDBConnectionClosesConnectionWhenDisablingAutoCommitFails() throws Exception {

        Connection connection = Mockito.mock(Connection.class);
        Mockito.when(dataSource.getConnection()).thenReturn(connection);
        Mockito.doThrow(new SQLException("auto-commit failure")).when(connection).setAutoCommit(false);

        DPDPCommonRuntimeException exception = expectThrows(DPDPCommonRuntimeException.class,
                () -> JDBCPersistenceManager.getInstance().getDBConnection());

        assertEquals(exception.getCause().getMessage(), "auto-commit failure");
        Mockito.verify(connection).close();
    }

    @Test
    public void getDBConnectionPreservesCloseFailureWhenDisablingAutoCommitFails() throws Exception {

        Connection connection = Mockito.mock(Connection.class);
        Mockito.when(dataSource.getConnection()).thenReturn(connection);
        SQLException autoCommitFailure = new SQLException("auto-commit failure");
        SQLException closeFailure = new SQLException("close failure");
        Mockito.doThrow(autoCommitFailure).when(connection).setAutoCommit(false);
        Mockito.doThrow(closeFailure).when(connection).close();

        DPDPCommonRuntimeException exception = expectThrows(DPDPCommonRuntimeException.class,
                () -> JDBCPersistenceManager.getInstance().getDBConnection());

        assertSame(exception.getCause(), autoCommitFailure);
        assertSame(exception.getCause().getSuppressed()[0], closeFailure);
    }

    @Test
    public void getDataSourceReturnsTheResolvedDataSource() {

        assertSame(JDBCPersistenceManager.getInstance().getDataSource(), dataSource);
    }

    @Test
    public void commitTransactionCommitsANonNullConnection() throws SQLException {

        Connection connection = Mockito.mock(Connection.class);
        JDBCPersistenceManager.getInstance().commitTransaction(connection);
        Mockito.verify(connection).commit();
    }

    @Test
    public void commitTransactionToleratesNull() {

        JDBCPersistenceManager.getInstance().commitTransaction(null);
    }

    @Test
    public void commitTransactionSwallowsSqlException() throws SQLException {

        Connection connection = Mockito.mock(Connection.class);
        Mockito.doThrow(new SQLException("boom")).when(connection).commit();
        JDBCPersistenceManager.getInstance().commitTransaction(connection);
    }

    @Test
    public void rollbackTransactionRollsBackANonNullConnection() throws SQLException {

        Connection connection = Mockito.mock(Connection.class);
        JDBCPersistenceManager.getInstance().rollbackTransaction(connection);
        Mockito.verify(connection).rollback();
    }

    @Test
    public void rollbackTransactionToleratesNull() {

        JDBCPersistenceManager.getInstance().rollbackTransaction(null);
    }

    @Test
    public void rollbackTransactionSwallowsSqlException() throws SQLException {

        Connection connection = Mockito.mock(Connection.class);
        Mockito.doThrow(new SQLException("boom")).when(connection).rollback();
        JDBCPersistenceManager.getInstance().rollbackTransaction(connection);
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
}
