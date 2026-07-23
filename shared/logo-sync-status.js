const LOGO_SYNC_STATES = new Set([
  'idle',
  'preparing',
  'transferring',
  'complete',
  'error',
])

const PREPARING_STATES = new Set([
  'planning',
  'manifest_ready',
  'downloading',
  'staged',
])
const TRANSFERRING_STATES = new Set([
  'transfer_queued',
  'transferring',
  'transfer_sent',
])
const ERROR_STATES = new Set([
  'failed',
  'download_failed',
  'transfer_failed',
])

function nonNegativeInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

export function normalizeLogoSyncStatus(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const total = nonNegativeInteger(source.total)
  const completed = Math.min(nonNegativeInteger(source.completed), total)
  const status = LOGO_SYNC_STATES.has(source.status)
    ? source.status
    : 'idle'

  return {
    status,
    season:
      typeof source.season === 'string' && /^\d{4}-07-01$/.test(source.season)
        ? source.season
        : null,
    completed: status === 'complete' ? total : completed,
    total,
    lastError:
      typeof source.lastError === 'string' && source.lastError
        ? source.lastError
        : null,
    updatedAt: nonNegativeInteger(source.updatedAt),
  }
}

export function mergeLogoSyncStatus(current, patch, nowMs = Date.now()) {
  return normalizeLogoSyncStatus({
    ...normalizeLogoSyncStatus(current),
    ...(patch && typeof patch === 'object' ? patch : {}),
    updatedAt: nowMs,
  })
}

export function logoSyncPatchFromCatalogResult(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const remoteStatus = String(source.status || '')
  const total = nonNegativeInteger(
    source.totalTeams || (source.manifest && source.manifest.totalTeams),
  )
  const completed = Math.min(nonNegativeInteger(source.readyLogos), total)
  const season =
    source.season || (source.manifest && source.manifest.season) || null
  const base = { season, total, completed }

  if (ERROR_STATES.has(remoteStatus)) {
    return {
      ...base,
      status: 'error',
      lastError: String(source.lastError || 'Logo sync failed'),
    }
  }
  if (TRANSFERRING_STATES.has(remoteStatus)) {
    return { ...base, status: 'transferring', lastError: null }
  }
  if (remoteStatus === 'active') {
    return { ...base, status: 'complete', lastError: null }
  }
  if (PREPARING_STATES.has(remoteStatus) || source.queued === true) {
    return { ...base, status: 'preparing', lastError: null }
  }
  return { ...base, status: 'idle', lastError: null }
}

export function logoSyncDisplayModel(value = {}) {
  const status = normalizeLogoSyncStatus(value)
  const progress =
    status.total > 0 &&
    (status.status === 'preparing' || status.status === 'transferring')
      ? `${status.completed}/${status.total}`
      : null

  if (status.status === 'preparing') {
    return { valueKey: 'logo_sync_preparing', progress }
  }
  if (status.status === 'transferring') {
    return { valueKey: 'logo_sync_transferring', progress }
  }
  if (status.status === 'complete') {
    return { valueKey: 'logo_sync_complete', progress: null }
  }
  if (status.status === 'error') {
    const unsupported = /not supported in simulator/i.test(
      status.lastError || '',
    )
    return {
      valueKey: unsupported
        ? 'logo_sync_unsupported'
        : 'logo_sync_failed',
      progress: null,
    }
  }
  return { valueKey: 'logo_sync_waiting', progress: null }
}
