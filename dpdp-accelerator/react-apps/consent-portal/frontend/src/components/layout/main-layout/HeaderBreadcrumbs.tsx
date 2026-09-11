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

import { Box, Breadcrumbs, Link, Typography } from '@wso2/oxygen-ui'
import { ChevronRight } from '@wso2/oxygen-ui-icons-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  path: string
  isCurrent: boolean
}

interface HeaderBreadcrumbsProps {
  currentLabel?: string
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function buildBreadcrumbItems(
  pathname: string,
  search: string,
  homeLabel: string,
  consentsLabel: string,
  pendingConsentsLabel: string,
  purposesLabel: string,
  elementsLabel: string,
  administrationLabel: string,
  administrationConsentsLabel: string,
  eventsLabel: string,
  subscriptionsLabel: string,
  topicsLabel: string,
  myComplaintsLabel: string,
  complaintManagementLabel: string,
): BreadcrumbItem[] {
  const complaintCaseDetailsMatch = pathname.match(/^\/complaint-management\/([^/]+)$/)

  if (complaintCaseDetailsMatch) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: administrationLabel,
        path: '/complaint-management',
        isCurrent: false,
      },
      {
        label: complaintManagementLabel,
        path: '/complaint-management',
        isCurrent: false,
      },
      {
        label: safeDecodeURIComponent(complaintCaseDetailsMatch[1]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/complaint-management')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: administrationLabel,
        path: '/complaint-management',
        isCurrent: false,
      },
      {
        label: complaintManagementLabel,
        path: '/complaint-management',
        isCurrent: true,
      },
    ]
  }

  const complaintDetailsMatch = pathname.match(/^\/complaints\/([^/]+)$/)

  if (complaintDetailsMatch) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: myComplaintsLabel,
        path: '/complaints',
        isCurrent: false,
      },
      {
        label: safeDecodeURIComponent(complaintDetailsMatch[1]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/complaints')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: myComplaintsLabel, path: '/complaints', isCurrent: true },
    ]
  }

  const adminConsentDetailsMatch = pathname.match(/^\/administration\/consents\/([^/]+)$/)

  if (adminConsentDetailsMatch) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: administrationLabel,
        path: '/administration/consents',
        isCurrent: false,
      },
      {
        label: administrationConsentsLabel,
        path: '/administration/consents',
        isCurrent: false,
      },
      {
        label: safeDecodeURIComponent(adminConsentDetailsMatch[1]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/administration/consents')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: administrationLabel,
        path: '/administration/consents',
        isCurrent: false,
      },
      {
        label: administrationConsentsLabel,
        path: '/administration/consents',
        isCurrent: true,
      },
    ]
  }

  const consentDetailsMatch = pathname.match(/^\/consents\/([^/]+)$/)

  if (consentDetailsMatch) {
    return [
      {
        label: homeLabel,
        path: '/dashboard',
        isCurrent: false,
      },
      {
        label: consentsLabel,
        path: '/consents',
        isCurrent: false,
      },
      {
        label: safeDecodeURIComponent(consentDetailsMatch[1]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/consents')) {
    const isPending = new URLSearchParams(search).get('view') === 'pending'

    return [
      {
        label: homeLabel,
        path: '/dashboard',
        isCurrent: false,
      },
      {
        label: isPending ? pendingConsentsLabel : consentsLabel,
        path: '/consents',
        isCurrent: true,
      },
    ]
  }

  const catalogDetailsMatch = pathname.match(/^\/(purposes|elements)\/([^/]+)$/)

  if (catalogDetailsMatch) {
    const section = catalogDetailsMatch[1]
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      {
        label: section === 'purposes' ? purposesLabel : elementsLabel,
        path: `/${section}`,
        isCurrent: false,
      },
      {
        label: safeDecodeURIComponent(catalogDetailsMatch[2]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/purposes')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: purposesLabel, path: '/purposes', isCurrent: true },
    ]
  }

  if (pathname.startsWith('/elements')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: elementsLabel, path: '/elements', isCurrent: true },
    ]
  }

  const subscriptionDetailsMatch = pathname.match(/^\/events\/subscriptions\/([^/]+)$/)

  if (subscriptionDetailsMatch) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: eventsLabel, path: '/events', isCurrent: false },
      { label: subscriptionsLabel, path: '/events/subscriptions', isCurrent: false },
      {
        label: safeDecodeURIComponent(subscriptionDetailsMatch[1]),
        path: pathname,
        isCurrent: true,
      },
    ]
  }

  if (pathname.startsWith('/events/subscriptions')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: eventsLabel, path: '/events', isCurrent: false },
      { label: subscriptionsLabel, path: '/events/subscriptions', isCurrent: true },
    ]
  }

  if (pathname.startsWith('/events/topics')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: eventsLabel, path: '/events', isCurrent: false },
      { label: topicsLabel, path: '/events/topics', isCurrent: true },
    ]
  }

  if (pathname.startsWith('/events')) {
    return [
      { label: homeLabel, path: '/dashboard', isCurrent: false },
      { label: eventsLabel, path: '/events', isCurrent: true },
    ]
  }

  return [
    {
      label: homeLabel,
      path: '/dashboard',
      isCurrent: true,
    },
  ]
}

function HeaderBreadcrumbs({ currentLabel }: HeaderBreadcrumbsProps): React.JSX.Element {
  const { t } = useTranslation('common')
  const location = useLocation()

  const breadcrumbItems = buildBreadcrumbItems(
    location.pathname,
    location.search,
    t('layout.home'),
    t('sidebar.allConsents'),
    t('sidebar.pendingConsents'),
    t('sidebar.purposes'),
    t('sidebar.elements'),
    t('sidebar.administration'),
    t('sidebar.adminConsents'),
    t('sidebar.events'),
    t('sidebar.subscriptions'),
    t('sidebar.topics'),
    t('sidebar.myComplaints'),
    t('sidebar.complaintManagement'),
  ).map((item) => (item.isCurrent && currentLabel ? { ...item, label: currentLabel } : item))

  return (
    <Box component="nav" aria-label={t('layout.breadcrumbAriaLabel')}>
      <Breadcrumbs
        separator={
          <Box component="span" sx={{ display: 'inline-flex', transform: 'translateY(1px)' }}>
            <ChevronRight size={14} aria-hidden="true" />
          </Box>
        }
      >
        {breadcrumbItems.map((item) =>
          item.isCurrent ? (
            <Typography
              key={`${item.path}-${item.label}-current`}
              component="span"
              variant="body2"
              color="text.primary"
              fontWeight={600}
              aria-current="page"
            >
              {item.label}
            </Typography>
          ) : (
            <Link
              key={`${item.path}-${item.label}`}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="text.secondary"
              variant="body2"
              sx={{ '&:hover': { color: 'text.primary' } }}
            >
              {item.label}
            </Link>
          ),
        )}
      </Breadcrumbs>
    </Box>
  )
}

HeaderBreadcrumbs.defaultProps = {
  currentLabel: undefined,
}

export default HeaderBreadcrumbs
