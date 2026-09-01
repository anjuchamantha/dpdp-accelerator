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

import { Button, MenuItem, Stack, TextField } from '@wso2/oxygen-ui'
import { Search, X } from '@wso2/oxygen-ui-icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  DeliveryMode,
  SubscriptionFilters as SubscriptionFiltersModel,
  SubscriptionStatus,
} from '../../../types/subscription'
import { DELIVERY_MODES, SUBSCRIPTION_STATUSES } from '../../../types/subscription'

interface SubscriptionFiltersProps {
  filters: SubscriptionFiltersModel
  onFilterChange: (filters: SubscriptionFiltersModel) => void
  onClear: () => void
}

export default function SubscriptionFilters({
  filters,
  onFilterChange,
  onClear,
}: SubscriptionFiltersProps): React.JSX.Element {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState(filters.search)
  const [status, setStatus] = useState<'All' | SubscriptionStatus>(filters.status)
  const [deliveryMode, setDeliveryMode] = useState<'All' | DeliveryMode>(filters.deliveryMode)

  const isFiltered =
    filters.status !== 'All' || filters.deliveryMode !== 'All' || Boolean(filters.search)

  const handleSearchSubmit = (event: React.FormEvent): void => {
    event.preventDefault()
    onFilterChange({ status, deliveryMode, search: search.trim() })
  }

  const handleStatusChange = (nextStatus: 'All' | SubscriptionStatus): void => {
    setStatus(nextStatus)
    onFilterChange({ status: nextStatus, deliveryMode, search: search.trim() })
  }

  const handleDeliveryModeChange = (nextMode: 'All' | DeliveryMode): void => {
    setDeliveryMode(nextMode)
    onFilterChange({ status, deliveryMode: nextMode, search: search.trim() })
  }

  const handleClear = (): void => {
    setSearch('')
    setStatus('All')
    setDeliveryMode('All')
    onClear()
  }

  return (
    <Stack
      component="form"
      onSubmit={handleSearchSubmit}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems="center"
    >
      <TextField
        size="small"
        placeholder={t('subscriptions.filters.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        InputProps={{
          startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.6 }} />,
        }}
        sx={{ minWidth: 260, flex: 1 }}
      />

      <TextField
        select
        size="small"
        label={t('subscriptions.filters.status')}
        value={status}
        onChange={(event) => handleStatusChange(event.target.value as 'All' | SubscriptionStatus)}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="All">{t('subscriptions.filters.allStatuses')}</MenuItem>
        {SUBSCRIPTION_STATUSES.map((option) => (
          <MenuItem key={option} value={option}>
            {t(`subscriptions.status.${option.toLowerCase()}`, option)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label={t('subscriptions.filters.deliveryMode')}
        value={deliveryMode}
        onChange={(event) => handleDeliveryModeChange(event.target.value as 'All' | DeliveryMode)}
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="All">{t('subscriptions.filters.allModes')}</MenuItem>
        {DELIVERY_MODES.map((option) => (
          <MenuItem key={option} value={option}>
            {t(`subscriptions.deliveryMode.${option.toLowerCase()}`, option)}
          </MenuItem>
        ))}
      </TextField>

      <Button size="small" type="submit" variant="outlined">
        {t('subscriptions.filters.search')}
      </Button>

      {isFiltered ? (
        <Button size="small" startIcon={<X size={15} />} onClick={handleClear}>
          {t('subscriptions.filters.clear')}
        </Button>
      ) : null}
    </Stack>
  )
}
