import assert from 'node:assert/strict'
import test from 'node:test'
import { planLogoCatalogActivation } from '../shared/logo-catalog-activation.js'
import { markLogoCatalogActivated } from '../app-side/logo-catalog-service.js'

const expectedAssets = [
  { teamId: '359', revision: '2026-07-01-359', byteLength: 5000 },
  { teamId: '83', revision: '2026-07-01-83', byteLength: 5202 },
]

function transferState(overrides = {}) {
  return {
    season: '2026-07-01',
    status: 'ready',
    totalTeams: 2,
    expectedAssets,
    assets: {
      '359': {
        localPath: 'data://new-359.tga',
        revision: '2026-07-01-359',
        byteLength: 5000,
      },
      '83': {
        localPath: 'data://new-83.tga',
        revision: '2026-07-01-83',
        byteLength: 5202,
      },
    },
    ...overrides,
  }
}

function memorySettings(initialValue) {
  const values = new Map()
  if (initialValue) {
    values.set('clubPulse.logoCatalog.syncState', JSON.stringify(initialValue))
  }
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('incomplete packages never replace the active catalog', () => {
  const current = {
    season: '2025-07-01',
    assets: {
      '83': {
        localPath: 'data://old-83.tga',
        revision: '2025-07-01-83',
        byteLength: 4000,
      },
    },
  }
  const result = planLogoCatalogActivation(current, transferState({
    status: 'receiving',
  }))
  assert.equal(result.activated, false)
  assert.equal(result.active.season, '2025-07-01')
  assert.deepEqual(result.stalePaths, [])
})

test('a verified ready package activates and retires old watch files', () => {
  const current = {
    season: '2025-07-01',
    assets: {
      old: {
        localPath: 'data://old-logo.tga',
        revision: '2025-07-01-old',
        byteLength: 4000,
      },
    },
  }
  const result = planLogoCatalogActivation(current, transferState(), 12345)
  assert.equal(result.activated, true)
  assert.equal(result.active.season, '2026-07-01')
  assert.equal(result.active.activatedAt, 12345)
  assert.equal(result.transfer.status, 'active')
  assert.deepEqual(result.stalePaths, ['data://old-logo.tga'])
})

test('mismatched file metadata blocks activation', () => {
  const invalid = transferState()
  invalid.assets['83'].byteLength = 1
  const result = planLogoCatalogActivation(null, invalid)
  assert.equal(result.activated, false)
  assert.equal(result.active.season, null)
})

test('activating the same package again is idempotent', () => {
  const first = planLogoCatalogActivation(null, transferState(), 12345)
  const second = planLogoCatalogActivation(first.active, first.transfer, 67890)
  assert.equal(second.activated, false)
  assert.equal(second.active.activatedAt, 12345)
  assert.equal(second.transfer.status, 'active')
})

test('pending cleanup survives a restart after the atomic switch', () => {
  const active = {
    ...planLogoCatalogActivation(null, transferState(), 12345).active,
    cleanupPaths: ['data://retired-logo.tga'],
  }
  const result = planLogoCatalogActivation(active, transferState(), 67890)
  assert.equal(result.activated, false)
  assert.deepEqual(result.stalePaths, ['data://retired-logo.tga'])
})

test('phone records a successful season only after watch acknowledgement', () => {
  const settings = memorySettings({
    status: 'transfer_sent',
    stagedSeason: '2026-07-01',
    manifest: { season: '2026-07-01', totalTeams: 2 },
    stagedAssets: { '359': {}, '83': {} },
  })
  const result = markLogoCatalogActivated(
    { settings },
    { season: '2026-07-01', totalTeams: 2, nowMs: 12345 },
  )
  assert.equal(result.status, 'active')
  assert.equal(result.lastSuccessfulSeason, '2026-07-01')
  assert.equal(result.activatedAt, 12345)
})
