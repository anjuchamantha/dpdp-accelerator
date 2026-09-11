/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AcrylicOrangeTheme, CssBaseline, OxygenUIThemeProvider } from '@wso2/oxygen-ui'
import AppSidebar from '../components/layout/sidebar/AppSidebar'
import i18n from '../i18n/i18n'
import TestAuthorizationProvider from './TestAuthorizationProvider'
import { REQUIRED_SCOPES } from '../utils/scopes'

function LocationProbe(): React.JSX.Element {
  const location = useLocation()

  return <p>{`${location.pathname}${location.search}`}</p>
}

afterEach(() => {
  cleanup()
})

describe('AppSidebar', () => {
  it('renders navigation items and navigates to dashboard and pending consents', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <CssBaseline />
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/consents']}>
            <TestAuthorizationProvider
              scopes={Object.values(REQUIRED_SCOPES)}
              hideSelfConsentsForAdmins={false}
            >
              <Routes>
                <Route
                  path="*"
                  element={
                    <>
                      <AppSidebar collapsed={false} />
                      <LocationProbe />
                    </>
                  }
                />
              </Routes>
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText('All Consents')).toBeInTheDocument()
    expect(screen.getByText('/consents')).toBeInTheDocument()
    const navigationText = screen.getByRole('navigation').textContent ?? ''
    expect(navigationText.indexOf('Administration')).toBeLessThan(
      navigationText.indexOf('Definitions'),
    )

    fireEvent.click(screen.getByText('My Pending Consents'))

    expect(screen.getByText('/consents?view=pending&state=PENDING')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Dashboard'))

    expect(screen.getByText('/dashboard')).toBeInTheDocument()
  })

  it('hides unauthorized items and empty categories', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/purposes']}>
            <TestAuthorizationProvider scopes={[REQUIRED_SCOPES.PURPOSES_READ]}>
              <AppSidebar collapsed={false} />
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getByText('Purposes')).toBeInTheDocument()
    expect(screen.queryByText('Consents')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Elements')).not.toBeInTheDocument()
    expect(screen.queryByText('Administration')).not.toBeInTheDocument()
  })

  it('shows administration consents independently from self-service consents', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/administration/consents']}>
            <TestAuthorizationProvider scopes={[REQUIRED_SCOPES.CONSENTS_READ_ANY]}>
              <Routes>
                <Route
                  path="*"
                  element={
                    <>
                      <AppSidebar collapsed={false} />
                      <LocationProbe />
                    </>
                  }
                />
              </Routes>
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getByText('Administration')).toBeInTheDocument()
    expect(screen.getByText('All Consents')).toBeInTheDocument()
    expect(screen.queryByText('Consents')).not.toBeInTheDocument()
    expect(screen.queryByText('My Consents')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.getByText('/administration/consents')).toBeInTheDocument()
  })

  it('hides self-service consents for admins when hideSelfConsentsForAdmins is true', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/administration/consents']}>
            <TestAuthorizationProvider
              scopes={[REQUIRED_SCOPES.CONSENTS_READ_SELF, REQUIRED_SCOPES.CONSENTS_READ_ANY]}
              hideSelfConsentsForAdmins
            >
              <AppSidebar collapsed={false} />
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getByText('All Consents')).toBeInTheDocument()
    expect(screen.queryByText('My Consents')).not.toBeInTheDocument()
    expect(screen.queryByText('My Pending Consents')).not.toBeInTheDocument()
    expect(screen.queryByText('Consents')).not.toBeInTheDocument()
  })

  it('still shows self-service consents for a non-admin even when hideSelfConsentsForAdmins is true', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/consents']}>
            <TestAuthorizationProvider
              scopes={[REQUIRED_SCOPES.CONSENTS_READ_SELF]}
              hideSelfConsentsForAdmins
            >
              <AppSidebar collapsed={false} />
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getByText('My Consents')).toBeInTheDocument()
    expect(screen.getByText('My Pending Consents')).toBeInTheDocument()
  })

  it('renders and navigates to events list, topics, and subscriptions', () => {
    render(
      <OxygenUIThemeProvider theme={AcrylicOrangeTheme}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/events/subscriptions']}>
            <TestAuthorizationProvider
              scopes={[
                REQUIRED_SCOPES.EVENTS_READ,
                REQUIRED_SCOPES.EVENT_TOPICS_READ,
                REQUIRED_SCOPES.EVENT_SUBSCRIPTIONS_READ,
              ]}
            >
              <Routes>
                <Route
                  path="*"
                  element={
                    <>
                      <AppSidebar collapsed={false} />
                      <LocationProbe />
                    </>
                  }
                />
              </Routes>
            </TestAuthorizationProvider>
          </MemoryRouter>
        </I18nextProvider>
      </OxygenUIThemeProvider>,
    )

    expect(screen.getAllByText('Events').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Topics')).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('/events/subscriptions')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Topics'))
    expect(screen.getByText('/events/topics')).toBeInTheDocument()
  })
})
