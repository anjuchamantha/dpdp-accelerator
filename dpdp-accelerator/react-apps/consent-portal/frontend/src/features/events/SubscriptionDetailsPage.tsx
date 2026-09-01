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
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@wso2/oxygen-ui'
import {
  ArrowLeft,
  Clock3,
  Globe,
  Layers,
  Radio,
  RefreshCw,
  Tag,
  Trash2,
  Users,
} from '@wso2/oxygen-ui-icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import CopyableText from '../../components/CopyableText'
import HeaderBreadcrumbs from '../../components/layout/main-layout/HeaderBreadcrumbs'
import { formatEpochTimestamp } from '../../utils/dateTime'
import { REQUIRED_SCOPES } from '../../utils/scopes'
import useAuthorization from '../auth/useAuthorization'
import DetailGrid from '../catalog/components/DetailGrid'
import SubscriptionDeleteDialog from './components/SubscriptionDeleteDialog'
import SubscriptionDeliveryEventsTable from './components/SubscriptionDeliveryEventsTable'
import {
  useDeleteSubscriptionMutation,
  useSubscriptionDetailQuery,
  useVerifySubscriptionMutation,
} from './hooks/useSubscriptionQueries'
import { getSubscriptionStatusChipColor } from './utils/subscriptionStatusChip'

export default function SubscriptionDetailsPage(): React.JSX.Element {
  const { t } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const detailQuery = useSubscriptionDetailQuery(id)
  const deleteMutation = useDeleteSubscriptionMutation()
  const verifyMutation = useVerifySubscriptionMutation()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null)

  const { hasScope } = useAuthorization()
  const canWrite = hasScope(REQUIRED_SCOPES.EVENT_SUBSCRIPTIONS_WRITE)

  const sub = detailQuery.data

  if (detailQuery.isLoading) {
    return (
      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <HeaderBreadcrumbs />
          <Skeleton width={300} height={48} />
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={320} />
        </Stack>
      </Box>
    )
  }

  if (detailQuery.isError || !sub) {
    return (
      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <HeaderBreadcrumbs />
          <Alert severity="error">{t('subscriptions.details.loadFailed')}</Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate('/events/subscriptions')}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('subscriptions.actions.backToList')}
          </Button>
        </Stack>
      </Box>
    )
  }

  const statusStr = (sub.status || 'ACTIVE').toUpperCase()
  const isDeleted = statusStr === 'DELETED'
  const deliveryMode = (sub.delivery?.mode || 'webhook').toLowerCase()
  const isWebhook = deliveryMode === 'webhook'
  const filterType = sub.filter?.type || 'all'

  const handleVerify = (): void => {
    if (!sub) return
    verifyMutation.mutate(sub.subscriptionId, {
      onSuccess: () => {
        setSnackbarMessage(
          t('subscriptions.verification.success', 'Verification triggered successfully.'),
        )
      },
      onError: (err) => {
        setSnackbarMessage(
          err.message || t('subscriptions.verification.failed', 'Verification failed.'),
        )
      },
    })
  }

  return (
    <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <HeaderBreadcrumbs currentLabel={sub.subscriptionId} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowLeft size={16} />}
                onClick={() => navigate('/events/subscriptions')}
              >
                {t('subscriptions.actions.backToList')}
              </Button>
              <Typography variant="h4" fontWeight={700}>
                {sub.topic}
              </Typography>
              <Chip
                size="small"
                color={getSubscriptionStatusChipColor(statusStr)}
                label={t(`subscriptions.status.${statusStr.toLowerCase()}`, statusStr)}
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              {canWrite && isWebhook && !isDeleted ? (
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshCw size={16} />}
                  disabled={verifyMutation.isPending}
                  onClick={handleVerify}
                >
                  {t('subscriptions.actions.verify')}
                </Button>
              ) : null}

              {canWrite ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Trash2 size={16} />}
                  disabled={isDeleted || deleteMutation.isPending}
                  onClick={() => setIsDeleteOpen(true)}
                >
                  {t('subscriptions.actions.delete')}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Stack>

        <Card sx={{ border: 1, borderColor: 'divider', boxShadow: 1 }}>
          <CardHeader
            title={
              <Typography variant="h6" fontWeight={700}>
                {t('subscriptions.details.configTitle')}
              </Typography>
            }
            subheader={
              <Typography variant="body2" color="text.secondary">
                {t('subscriptions.details.configSubtitle')}
              </Typography>
            }
          />
          <Divider />
          <CardContent sx={{ p: 3 }}>
            <DetailGrid
              fields={[
                {
                  icon: <Tag size={16} />,
                  label: t('subscriptions.table.subscriptionId'),
                  value: <CopyableText value={sub.subscriptionId} monospace />,
                },
                {
                  icon: <Radio size={16} />,
                  label: t('subscriptions.table.topic'),
                  value: sub.topic,
                },
                {
                  icon: <Users size={16} />,
                  label: t('subscriptions.table.groupId'),
                  value: sub.groupId ? <CopyableText value={sub.groupId} monospace /> : '-',
                },
                {
                  icon: <Globe size={16} />,
                  label: t('subscriptions.table.deliveryMode'),
                  value: (
                    <Chip
                      size="small"
                      color={isWebhook ? 'primary' : 'default'}
                      variant={isWebhook ? 'filled' : 'outlined'}
                      label={t(`subscriptions.deliveryMode.${deliveryMode}`, deliveryMode)}
                    />
                  ),
                },
                {
                  icon: <Globe size={16} />,
                  label: t('subscriptions.dialog.callbackUrlLabel'),
                  value: sub.delivery?.callbackUrl || '-',
                },
                {
                  icon: <Layers size={16} />,
                  label: t('subscriptions.table.filter'),
                  value: (
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`subscriptions.filterType.${filterType}`, filterType)}
                      />
                      {sub.filter?.purposes?.map((purpose) => (
                        <Chip key={purpose} size="small" label={purpose} />
                      ))}
                    </Stack>
                  ),
                },
                {
                  icon: <Clock3 size={16} />,
                  label: t('subscriptions.details.createdAt'),
                  value: formatEpochTimestamp(sub.createdAt),
                },
                {
                  icon: <Clock3 size={16} />,
                  label: t('subscriptions.details.updatedAt'),
                  value: formatEpochTimestamp(sub.updatedAt),
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card sx={{ border: 1, borderColor: 'divider', boxShadow: 1 }}>
          <CardHeader
            title={
              <Typography variant="h6" fontWeight={700}>
                {t('subscriptions.details.eventsTitle')}
              </Typography>
            }
            subheader={
              <Typography variant="body2" color="text.secondary">
                {t('subscriptions.details.eventsSubtitle')}
              </Typography>
            }
          />
          <Divider />
          <CardContent sx={{ p: 3 }}>
            <SubscriptionDeliveryEventsTable subscriptionId={sub.subscriptionId} />
          </CardContent>
        </Card>

        {isDeleteOpen ? (
          <SubscriptionDeleteDialog
            open
            subscription={sub}
            loading={deleteMutation.isPending}
            error={deleteMutation.error?.message}
            onClose={() => {
              setIsDeleteOpen(false)
              deleteMutation.reset()
            }}
            onConfirm={() => {
              deleteMutation.mutate(sub.subscriptionId, {
                onSuccess: () => {
                  setIsDeleteOpen(false)
                  navigate('/events/subscriptions')
                },
              })
            }}
          />
        ) : null}

        <Snackbar
          open={Boolean(snackbarMessage)}
          autoHideDuration={4000}
          onClose={() => setSnackbarMessage(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbarMessage(null)}
            severity={verifyMutation.isError ? 'error' : 'success'}
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  )
}
