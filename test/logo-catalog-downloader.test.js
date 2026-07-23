import assert from 'node:assert/strict'
import test from 'node:test'
import {
  downloadAndConvertCatalogLogo,
  getLogoCatalogDownloadStatus,
  phoneLogoSlot,
  phoneLogoTargetPath,
  stageSeasonalLogoCatalog,
} from '../app-side/logo-catalog-downloader.js'
import {
  readLogoCatalogState,
  writeLogoCatalogState,
} from '../app-side/logo-catalog-service.js'
import {
  LOGO_CATALOG_ASSET_VERSION,
  logoCatalogAssetRevision,
} from '../shared/logo-catalog.js'

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

function manifest() {
  return {
    season: '2026-07-01',
    totalTeams: 2,
    teams: [
      { id: '359', name: 'Arsenal', logoUrl: 'https://example.com/359.png' },
      { id: '83', name: 'Barcelona', logoUrl: 'https://example.com/83.png' },
    ],
  }
}

test('downloads to a temporary path and converts to a persistent slot path', async () => {
  const calls = []
  const sideService = {
    download(url, options) {
      calls.push({ type: 'download', url, options })
      const task = {}
      queueMicrotask(() => {
        task.onSuccess({
          statusCode: 200,
          tempFilePath: 'data://download/temp.png',
        })
      })
      return task
    },
    async convert(options) {
      calls.push({ type: 'convert', options })
      return {
        targetFilePath: options.targetFilePath,
        options: { size: 5202 },
      }
    },
  }

  const asset = await downloadAndConvertCatalogLogo(sideService, {
    season: '2026-07-01',
    team: manifest().teams[1],
  })

  assert.equal(calls[0].options.filePath, undefined)
  assert.equal(calls[0].options.timeout, 30_000)
  assert.equal(asset.teamId, '83')
  assert.equal(asset.byteLength, 5202)
  assert.equal(
    asset.revision,
    logoCatalogAssetRevision('2026-07-01', '83'),
  )
  assert.equal(
    asset.filePath,
    'data://download/clubpulse-logo-b-83.tga',
  )
})

test('phone packages alternate between two bounded storage slots', () => {
  assert.equal(LOGO_CATALOG_ASSET_VERSION, 2)
  assert.equal(phoneLogoSlot('2026-07-01'), 'b')
  assert.equal(phoneLogoSlot('2027-07-01'), 'a')
  assert.equal(phoneLogoSlot('2028-07-01'), 'b')
  assert.equal(phoneLogoSlot('2026-07-01', 1), 'a')
})

test('stages every manifest logo and persists completion', async () => {
  const settings = memorySettings()
  const sideService = { settings }
  writeLogoCatalogState(settings, {
    status: 'manifest_ready',
    manifest: manifest(),
  })

  const status = await stageSeasonalLogoCatalog(sideService, {
    stageLogo: async (_service, { season, team }) => ({
      teamId: team.id,
      filePath: phoneLogoTargetPath(season, team.id),
      byteLength: 5202,
      revision: `${season}-${team.id}`,
      readyAt: 1,
    }),
  })

  assert.equal(status.status, 'staged')
  assert.equal(status.readyLogos, 2)
  assert.equal(status.totalTeams, 2)
  assert.equal(readLogoCatalogState(settings).stagedSeason, '2026-07-01')
})

test('failed staging preserves completed logos for a retry', async () => {
  const settings = memorySettings()
  const sideService = { settings }
  writeLogoCatalogState(settings, {
    status: 'manifest_ready',
    manifest: manifest(),
  })
  const attempts = []

  await assert.rejects(
    stageSeasonalLogoCatalog(sideService, {
      concurrency: 1,
      stageLogo: async (_service, { season, team }) => {
        attempts.push(team.id)
        if (team.id === '83') throw new Error('offline')
        return {
          teamId: team.id,
          filePath: phoneLogoTargetPath(season, team.id),
          byteLength: 5202,
          revision: `${season}-${team.id}`,
          readyAt: 1,
        }
      },
    }),
    /Failed to prepare 1 logo/,
  )

  assert.deepEqual(attempts, ['359', '83'])
  assert.deepEqual(
    getLogoCatalogDownloadStatus(settings).failedTeamIds,
    ['83'],
  )
  assert.equal(getLogoCatalogDownloadStatus(settings).readyLogos, 1)

  attempts.length = 0
  await stageSeasonalLogoCatalog(sideService, {
    concurrency: 1,
    stageLogo: async (_service, { season, team }) => {
      attempts.push(team.id)
      return {
        teamId: team.id,
        filePath: phoneLogoTargetPath(season, team.id),
        byteLength: 5202,
        revision: `${season}-${team.id}`,
        readyAt: 2,
      }
    },
  })

  assert.deepEqual(attempts, ['83'])
  assert.equal(getLogoCatalogDownloadStatus(settings).status, 'staged')
  assert.equal(getLogoCatalogDownloadStatus(settings).readyLogos, 2)
})
