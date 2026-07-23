import assert from 'node:assert/strict'
import test from 'node:test'
import {
  logoSyncDisplayModel,
  logoSyncPatchFromCatalogResult,
  mergeLogoSyncStatus,
  normalizeLogoSyncStatus,
} from '../shared/logo-sync-status.js'

test('logo sync status defaults safely and clamps progress', () => {
  assert.deepEqual(normalizeLogoSyncStatus(null), {
    status: 'idle',
    season: null,
    completed: 0,
    total: 0,
    lastError: null,
    updatedAt: 0,
  })

  assert.deepEqual(
    normalizeLogoSyncStatus({
      status: 'transferring',
      season: '2026-07-01',
      completed: 45,
      total: 40,
    }),
    {
      status: 'transferring',
      season: '2026-07-01',
      completed: 40,
      total: 40,
      lastError: null,
      updatedAt: 0,
    },
  )
})

test('merging logo sync status preserves progress and records update time', () => {
  const result = mergeLogoSyncStatus(
    {
      status: 'transferring',
      season: '2026-07-01',
      completed: 12,
      total: 40,
    },
    { completed: 13 },
    12345,
  )

  assert.deepEqual(result, {
    status: 'transferring',
    season: '2026-07-01',
    completed: 13,
    total: 40,
    lastError: null,
    updatedAt: 12345,
  })
})

test('complete logo sync status always reports the full total', () => {
  const result = mergeLogoSyncStatus(
    { status: 'transferring', completed: 39, total: 40 },
    { status: 'complete' },
    50,
  )

  assert.equal(result.completed, 40)
  assert.equal(result.status, 'complete')
})

test('phone catalog states map to watch-visible sync phases', () => {
  assert.deepEqual(
    logoSyncPatchFromCatalogResult({
      status: 'downloading',
      season: '2026-07-01',
      readyLogos: 12,
      totalTeams: 40,
    }),
    {
      status: 'preparing',
      season: '2026-07-01',
      completed: 12,
      total: 40,
      lastError: null,
    },
  )

  assert.equal(
    logoSyncPatchFromCatalogResult({ status: 'transfer_queued' }).status,
    'transferring',
  )
})

test('phone catalog failures preserve a useful error', () => {
  const result = logoSyncPatchFromCatalogResult({
    status: 'download_failed',
    season: '2026-07-01',
    totalTeams: 40,
    lastError: 'downloadFile is not supported in simulator',
  })

  assert.equal(result.status, 'error')
  assert.equal(result.lastError, 'downloadFile is not supported in simulator')
})

test('logo sync display model formats progress and simulator limitations', () => {
  assert.deepEqual(
    logoSyncDisplayModel({
      status: 'transferring',
      completed: 12,
      total: 40,
    }),
    { valueKey: 'logo_sync_transferring', progress: '12/40' },
  )
  assert.deepEqual(
    logoSyncDisplayModel({
      status: 'error',
      lastError: 'downloadFile is not supported in simulator',
    }),
    { valueKey: 'logo_sync_unsupported', progress: null },
  )
})
