import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beginLogoCatalogTransfer,
  normalizeLogoCatalogTransferState,
  receivedCatalogAssets,
  recordReceivedCatalogLogo,
} from '../shared/logo-catalog-transfer.js'
import { receiveCatalogLogo } from '../device/logo-catalog-receiver.js'
import { transferLogoCatalogFiles } from '../app-side/logo-catalog-transfer.js'
import {
  readLogoCatalogState,
  writeLogoCatalogState,
} from '../app-side/logo-catalog-service.js'

const transferManifest = {
  season: '2026-07-01',
  totalTeams: 2,
  assets: [
    { teamId: '359', revision: '2026-07-01-359', byteLength: 5000 },
    { teamId: '83', revision: '2026-07-01-83', byteLength: 5202 },
  ],
}

function memorySettings() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('watch transfer state preserves only matching revisions', () => {
  const current = {
    season: '2026-07-01',
    status: 'receiving',
    totalTeams: 2,
    expectedAssets: transferManifest.assets,
    assets: {
      '359': {
        localPath: 'data://359.tga',
        revision: '2026-07-01-359',
        byteLength: 5000,
      },
      '83': {
        localPath: 'data://old-83.tga',
        revision: 'old',
        byteLength: 5202,
      },
    },
  }

  const next = beginLogoCatalogTransfer(current, transferManifest)
  assert.deepEqual(Object.keys(next.assets), ['359'])
  assert.equal(next.status, 'receiving')
  assert.deepEqual(receivedCatalogAssets(next), [
    { teamId: '359', revision: '2026-07-01-359' },
  ])
})

test('watch accepts expected files and marks the package ready', () => {
  let state = beginLogoCatalogTransfer(null, transferManifest)
  let result = recordReceivedCatalogLogo(state, {
    season: '2026-07-01',
    teamId: '359',
    revision: '2026-07-01-359',
    byteLength: 5000,
    totalTeams: 2,
    localPath: 'data://359.tga',
  })
  assert.equal(result.accepted, true)
  assert.equal(result.complete, false)
  state = result.state

  result = recordReceivedCatalogLogo(state, {
    season: '2026-07-01',
    teamId: '83',
    revision: '2026-07-01-83',
    byteLength: 5202,
    totalTeams: 2,
    localPath: 'data://83.tga',
  })
  assert.equal(result.accepted, true)
  assert.equal(result.complete, true)
  assert.equal(result.state.status, 'ready')

  const rejected = recordReceivedCatalogLogo(result.state, {
    season: '2026-07-01',
    teamId: 'unknown',
    revision: 'unknown',
    byteLength: 1,
    totalTeams: 2,
    localPath: 'data://unknown.tga',
  })
  assert.equal(rejected.accepted, false)
})

test('catalog receiver reports a completed transferred file once', () => {
  const payloads = []
  const file = {
    readyState: 'transferred',
    filePath: 'data://83.tga',
    fileSize: 5202,
    params: {
      type: 'clubpulse-logo-catalog',
      season: '2026-07-01',
      teamId: '83',
      revision: '2026-07-01-83',
      byteLength: '5202',
      totalTeams: '2',
    },
  }

  assert.equal(receiveCatalogLogo(file, (payload) => payloads.push(payload)), true)
  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].teamId, '83')
})

test('phone skips files whose matching revision is already on the watch', async () => {
  const settings = memorySettings()
  writeLogoCatalogState(settings, {
    status: 'staged',
    manifest: {
      season: '2026-07-01',
      totalTeams: 2,
      teams: [{ id: '359' }, { id: '83' }],
    },
    stagedAssets: {
      '359': {
        filePath: 'data://phone-359.tga',
        revision: '2026-07-01-359',
        byteLength: 5000,
      },
      '83': {
        filePath: 'data://phone-83.tga',
        revision: '2026-07-01-83',
        byteLength: 5202,
      },
    },
  })
  const sent = []
  const sideService = {
    settings,
    sendFile(filePath, params) {
      sent.push({ filePath, params })
      const file = { readyState: 'pending' }
      file.on = (_event, callback) => {
        queueMicrotask(() => callback({ data: { readyState: 'transferred' } }))
      }
      return file
    },
  }

  await transferLogoCatalogFiles(sideService, transferManifest, [
    { teamId: '359', revision: '2026-07-01-359' },
  ])

  assert.deepEqual(sent.map((item) => item.params.teamId), ['83'])
  assert.equal(readLogoCatalogState(settings).status, 'transfer_sent')
  assert.equal(readLogoCatalogState(settings).transferCompleted, 2)
})

test('normalizer accepts persisted expected assets and in-memory maps', () => {
  const fromArray = normalizeLogoCatalogTransferState({
    season: '2026-07-01',
    expectedAssets: transferManifest.assets,
  })
  const fromMap = normalizeLogoCatalogTransferState(fromArray)
  assert.deepEqual(Object.keys(fromMap.expectedAssets).sort(), ['359', '83'])
})
