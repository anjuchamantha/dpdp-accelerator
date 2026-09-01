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

import {
  Button,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@wso2/oxygen-ui'
import { CircleSlash, RefreshCw, Search } from '@wso2/oxygen-ui-icons-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import CursorPaginationFooter from '../../../components/CursorPaginationFooter'
import type { ComplaintRecord } from '../../../types/complaint'
import { formatEpochTimestamp } from '../../../utils/dateTime'
import { COMPLAINT_LIST_ROWS_PER_PAGE_OPTIONS } from '../constants'
import ComplaintStatusChip from './ComplaintStatusChip'

interface ComplaintListTableProps {
  rows: ComplaintRecord[]
  isLoading: boolean
  isError: boolean
  isEmptyFiltered: boolean
  rowsPerPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onRowsPerPageChange: (rowsPerPage: number) => void
  onRetry: () => void
}

const COLUMN_COUNT = 5

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
}

export default function ComplaintListTable({
  rows,
  isLoading,
  isError,
  isEmptyFiltered,
  rowsPerPage,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  onRowsPerPageChange,
  onRetry,
}: ComplaintListTableProps): React.JSX.Element {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  return (
    <TableContainer component={Paper} elevation={1}>
      <Table aria-label={t('complaints.list.table.tableAriaLabel')}>
        <TableHead
          sx={(theme) => ({
            '& .MuiTableCell-head': {
              fontWeight: 600,
              ...theme.applyStyles('light', { backgroundColor: theme.palette.grey[50] }),
              ...theme.applyStyles('dark', { backgroundColor: 'rgba(255, 255, 255, 0.04)' }),
            },
          })}
        >
          <TableRow>
            <TableCell>{t('complaints.list.table.headers.referenceId')}</TableCell>
            <TableCell>{t('complaints.list.table.headers.category')}</TableCell>
            <TableCell>{t('complaints.list.table.headers.status')}</TableCell>
            <TableCell>{t('complaints.list.table.headers.submitted')}</TableCell>
            <TableCell>{t('complaints.list.table.headers.updated')}</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {isLoading
            ? Array.from({ length: rowsPerPage }, (_, rowIndex) => (
                <TableRow key={`skeleton-row-${String(rowIndex)}`}>
                  {Array.from({ length: COLUMN_COUNT }, (__, cellIndex) => (
                    <TableCell key={`skeleton-cell-${String(rowIndex)}-${String(cellIndex)}`}>
                      <Skeleton variant="text" width="80%" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}

          {!isLoading && isError ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} align="center" sx={{ py: 8 }}>
                <Stack spacing={1} alignItems="center" justifyContent="center">
                  <CircleSlash size={28} aria-hidden="true" />
                  <Typography fontWeight={600}>{t('complaints.list.loadFailed')}</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshCw size={16} />}
                    onClick={onRetry}
                  >
                    {t('catalog.actions.retry')}
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading && !isError && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} align="center" sx={{ py: 8 }}>
                <Stack spacing={1} alignItems="center" justifyContent="center">
                  <Search size={28} aria-hidden="true" />
                  <Typography fontWeight={600}>
                    {isEmptyFiltered
                      ? t('complaints.list.emptyFiltered')
                      : t('complaints.list.empty')}
                  </Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : null}

          {!isLoading && !isError
            ? rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => {
                    navigate(`/complaints/${encodeURIComponent(row.id)}`)
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>{row.referenceId}</TableCell>
                  <TableCell>{t(`complaints.categories.${row.category}`)}</TableCell>
                  <TableCell>
                    <ComplaintStatusChip status={row.status} viewerRole="DataPrincipal" />
                  </TableCell>
                  <TableCell>
                    {formatEpochTimestamp(row.submittedAt, DATE_FORMAT_OPTIONS)}
                  </TableCell>
                  <TableCell>{formatEpochTimestamp(row.updatedAt, DATE_FORMAT_OPTIONS)}</TableCell>
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>

      <CursorPaginationFooter
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={COMPLAINT_LIST_ROWS_PER_PAGE_OPTIONS}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        disabled={isLoading}
        onRowsPerPageChange={onRowsPerPageChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />
    </TableContainer>
  )
}
