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
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@wso2/oxygen-ui'
import { Eye } from '@wso2/oxygen-ui-icons-react'
import { useTranslation } from 'react-i18next'
import CopyableText from '../../../components/CopyableText'
import CursorPaginationFooter from '../../../components/CursorPaginationFooter'
import type { EventRecord } from '../../../types/event'
import { formatEpochTimestamp } from '../../../utils/dateTime'

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const

interface EventTableProps {
  rows: EventRecord[]
  isLoading: boolean
  isError: boolean
  rowsPerPage: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onRowsPerPageChange: (rowsPerPage: number) => void
  onRetry: () => void
  onViewDetails: (event: EventRecord) => void
}

export default function EventTable({
  rows,
  isLoading,
  isError,
  rowsPerPage,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  onRowsPerPageChange,
  onRetry,
  onViewDetails,
}: EventTableProps): React.JSX.Element {
  const { t } = useTranslation('common')

  if (isError) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('events.loadFailed')}
        </Alert>
        <Button variant="outlined" onClick={onRetry}>
          {t('authorization.tryAgain')}
        </Button>
      </Paper>
    )
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden', boxShadow: 1 }}>
      {isLoading ? <LinearProgress /> : null}
      <TableContainer>
        <Table aria-label={t('events.table.ariaLabel')}>
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
              <TableCell>{t('events.table.eventId')}</TableCell>
              <TableCell>{t('events.table.groupId', 'Group ID')}</TableCell>
              <TableCell>{t('events.table.topic')}</TableCell>
              <TableCell>{t('events.table.purposes', 'Purposes')}</TableCell>
              <TableCell>{t('events.table.deliveries', 'Deliveries')}</TableCell>
              <TableCell>{t('events.table.occurredAt')}</TableCell>
              <TableCell align="right">{t('events.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && !isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">{t('events.table.empty')}</Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((event) => {
              const displayTopic = event.topic || event.topicId || '-'
              const purposes = event.purposes ?? []
              const deliveriesCount = event.deliveriesCount ?? (event.deliveryId ? 1 : 0)

              return (
                <TableRow
                  key={event.eventId}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onViewDetails(event)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <CopyableText value={event.eventId} truncateAt={14} monospace />
                  </TableCell>
                  <TableCell>
                    {event.groupId ? (
                      <Chip size="small" variant="outlined" label={event.groupId} />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {displayTopic}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {purposes.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {purposes.map((p) => (
                          <Chip key={p} size="small" variant="outlined" label={p} />
                        ))}
                      </Box>
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('events.purposes.all', 'ALL')}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {deliveriesCount > 0 ? (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`${deliveriesCount} ${deliveriesCount === 1 ? t('events.table.subscriber', 'Subscriber') : t('events.table.subscribers', 'Subscribers')}`}
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t('events.table.noSubscribers', 'No Subscribers')}
                        sx={{ color: 'text.secondary', fontWeight: 500 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{formatEpochTimestamp(event.occurredAt)}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={t('events.actions.view')}>
                      <span>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onViewDetails(event)}
                          aria-label={t('events.actions.view')}
                        >
                          <Eye size={16} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <CursorPaginationFooter
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        disabled={isLoading}
        onRowsPerPageChange={onRowsPerPageChange}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />
    </Paper>
  )
}
