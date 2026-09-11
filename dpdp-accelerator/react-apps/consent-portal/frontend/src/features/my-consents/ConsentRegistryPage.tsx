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

import { Box, Stack, Typography } from '@wso2/oxygen-ui'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import HeaderBreadcrumbs from '../../components/layout/main-layout/HeaderBreadcrumbs'
import ConsentApprovalDialog from './components/ConsentApprovalDialog'
import ConsentRegistryFilters from './components/ConsentRegistryFilters'
import ConsentRegistryTable from './components/ConsentRegistryTable'
import ConsentRevocationDialog from './components/ConsentRevocationDialog'
import { CONSENT_REGISTRY_ROWS_PER_PAGE_OPTIONS } from './constants'
import type {
  ConsentRegistryFilters as ConsentRegistryFiltersModel,
  ConsentRelation,
  ConsentState,
} from '../../types/consent'
import { CONSENT_RELATIONS, isConsentState } from '../../types/consent'
import { REQUIRED_SCOPES } from '../../utils/scopes'
import useAuthorization from '../auth/useAuthorization'
import {
  useApproveConsentMutation,
  useConsentListQuery,
  useRevokeConsentMutation,
} from './hooks/useConsentQueries'

const DEFAULT_FILTERS: ConsentRegistryFiltersModel = {
  state: 'All',
  serviceId: '',
  relation: 'ANY',
  createdAfter: '',
  createdBefore: '',
}

function isConsentRelation(value: string): value is ConsentRelation {
  return (CONSENT_RELATIONS as readonly string[]).includes(value)
}

const DEFAULT_PAGE = 0
const DEFAULT_ROWS_PER_PAGE = 10

function getFiltersFromSearchParams(
  searchParams: URLSearchParams,
  isPendingView: boolean,
): ConsentRegistryFiltersModel {
  const stateParam = searchParams.get('state') ?? ''
  const relationParam = searchParams.get('relation') ?? ''
  const state = isConsentState(stateParam) ? (stateParam as ConsentState) : DEFAULT_FILTERS.state
  const urlRelation = isConsentRelation(relationParam) ? relationParam : DEFAULT_FILTERS.relation

  return {
    state,
    serviceId: searchParams.get('serviceId') ?? DEFAULT_FILTERS.serviceId,
    relation: isPendingView ? 'ANY' : urlRelation,
    createdAfter: searchParams.get('createdAfter') ?? DEFAULT_FILTERS.createdAfter,
    createdBefore: searchParams.get('createdBefore') ?? DEFAULT_FILTERS.createdBefore,
  }
}

function getPageFromSearchParams(searchParams: URLSearchParams): number {
  const pageNumber = Number(searchParams.get('page') ?? '1')

  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber - 1 : DEFAULT_PAGE
}

function getRowsPerPageFromSearchParams(searchParams: URLSearchParams): number {
  const rowsPerPage = Number(searchParams.get('rowsPerPage') ?? String(DEFAULT_ROWS_PER_PAGE))

  return CONSENT_REGISTRY_ROWS_PER_PAGE_OPTIONS.includes(
    rowsPerPage as (typeof CONSENT_REGISTRY_ROWS_PER_PAGE_OPTIONS)[number],
  )
    ? rowsPerPage
    : DEFAULT_ROWS_PER_PAGE
}

function toSearchParams(
  filters: ConsentRegistryFiltersModel,
  page = DEFAULT_PAGE,
  rowsPerPage = DEFAULT_ROWS_PER_PAGE,
  isPendingView = false,
): URLSearchParams {
  const params = new URLSearchParams()

  if (isPendingView) {
    params.set('view', 'pending')
  }

  if (filters.state !== DEFAULT_FILTERS.state) {
    params.set('state', filters.state)
  }

  if (filters.serviceId.trim()) {
    params.set('serviceId', filters.serviceId.trim())
  }

  if (filters.relation !== DEFAULT_FILTERS.relation) {
    params.set('relation', filters.relation)
  }

  if (filters.createdAfter) {
    params.set('createdAfter', filters.createdAfter)
  }

  if (filters.createdBefore) {
    params.set('createdBefore', filters.createdBefore)
  }

  if (page !== DEFAULT_PAGE) {
    params.set('page', String(page + 1))
  }

  if (rowsPerPage !== DEFAULT_ROWS_PER_PAGE) {
    params.set('rowsPerPage', String(rowsPerPage))
  }

  return params
}

function ConsentRegistryPage(): React.JSX.Element {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const [approvalConsentID, setApprovalConsentID] = useState<string>()
  const [revocationConsentID, setRevocationConsentID] = useState<string>()
  const isPendingView = searchParams.get('view') === 'pending'
  const filters = useMemo(
    () => getFiltersFromSearchParams(searchParams, isPendingView),
    [isPendingView, searchParams],
  )
  const page = useMemo(() => getPageFromSearchParams(searchParams), [searchParams])
  const rowsPerPage = useMemo(() => getRowsPerPageFromSearchParams(searchParams), [searchParams])
  const consentListQuery = useConsentListQuery(filters, page, rowsPerPage)
  const { currentUser, hasScope } = useAuthorization()
  const approveMutation = useApproveConsentMutation(currentUser.userId)
  const revokeMutation = useRevokeConsentMutation()
  const canWriteSelf = hasScope(REQUIRED_SCOPES.CONSENTS_WRITE_SELF)
  const isTableLoading = consentListQuery.isPending || consentListQuery.isPlaceholderData

  const updateParams = (
    nextFilters: ConsentRegistryFiltersModel,
    nextPage = DEFAULT_PAGE,
    nextRowsPerPage = rowsPerPage,
  ): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage, nextRowsPerPage, isPendingView), {
      replace: true,
    })
  }

  return (
    <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <HeaderBreadcrumbs />
          <Typography variant="h4" fontWeight={700}>
            {isPendingView ? t('sidebar.pendingConsents') : t('sidebar.allConsents')}
          </Typography>
        </Stack>

        <ConsentRegistryFilters
          key={searchParams.toString()}
          filters={filters}
          isPendingView={isPendingView}
          onFilterChange={(nextFilters) => updateParams(nextFilters)}
          onClear={() => updateParams(DEFAULT_FILTERS)}
        />

        <ConsentRegistryTable
          rows={consentListQuery.data?.rows ?? []}
          isLoading={isTableLoading}
          isError={consentListQuery.isError}
          rowsPerPage={rowsPerPage}
          hasPreviousPage={page > DEFAULT_PAGE}
          hasNextPage={consentListQuery.data?.hasNextPage ?? false}
          onPreviousPage={() => updateParams(filters, page - 1)}
          onNextPage={() => updateParams(filters, page + 1)}
          onRowsPerPageChange={(nextRowsPerPage) =>
            updateParams(filters, DEFAULT_PAGE, nextRowsPerPage)
          }
          onRetry={() => consentListQuery.refetch()}
          showSubject={filters.relation !== 'SUBJECT'}
          currentUserId={currentUser.userId}
          canApprove={canWriteSelf}
          canRevoke={canWriteSelf}
          onApprove={setApprovalConsentID}
          onRevoke={setRevocationConsentID}
          isMutating={approveMutation.isPending || revokeMutation.isPending}
        />

        {approvalConsentID ? (
          <ConsentApprovalDialog
            open
            consentId={approvalConsentID}
            loading={approveMutation.isPending}
            error={approveMutation.error?.message}
            onClose={() => {
              setApprovalConsentID(undefined)
              approveMutation.reset()
            }}
            onConfirm={() => {
              approveMutation.mutate(approvalConsentID, {
                onSuccess: () => setApprovalConsentID(undefined),
              })
            }}
          />
        ) : null}

        {revocationConsentID ? (
          <ConsentRevocationDialog
            open
            consentId={revocationConsentID}
            loading={revokeMutation.isPending}
            error={revokeMutation.error?.message}
            onClose={() => {
              setRevocationConsentID(undefined)
              revokeMutation.reset()
            }}
            onConfirm={() => {
              revokeMutation.mutate(revocationConsentID, {
                onSuccess: () => setRevocationConsentID(undefined),
              })
            }}
          />
        ) : null}
      </Stack>
    </Box>
  )
}

export default ConsentRegistryPage
