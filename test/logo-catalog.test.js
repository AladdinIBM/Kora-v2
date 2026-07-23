import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLogoCatalogManifest,
  LOGO_CATALOG_ASSET_VERSION,
  logoCatalogSeason,
  logoCatalogSyncDecision,
  resizeEspnLogoUrl,
} from '../shared/logo-catalog.js'
import {
  LOGO_CATALOG_STATE_KEY,
  planSeasonalLogoCatalog,
  readLogoCatalogState,
} from '../app-side/logo-catalog-service.js'

function team(id, name, leagueCode) {
  return {
    id,
    name,
    shortName: name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    leagueCode,
    logoUrl:
      `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png` +
      '&w=100&h=100&scale=crop',
  }
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

test('logo season changes at local July 1', () => {
  assert.equal(
    logoCatalogSeason(new Date(2026, 5, 30, 23, 59).getTime()),
    '2025-07-01',
  )
  assert.equal(
    logoCatalogSeason(new Date(2026, 6, 1, 0, 0).getTime()),
    '2026-07-01',
  )
})

test('sync is due on install, season, asset upgrade, or outdated watch', () => {
  const nowMs = Date.UTC(2026, 6, 2)
  assert.equal(
    logoCatalogSyncDecision({ nowMs, firstInstall: true }).reason,
    'first_install',
  )
  assert.equal(
    logoCatalogSyncDecision({ nowMs, lastSuccessfulSeason: '2025-07-01' })
      .reason,
    'season_due',
  )
  assert.equal(
    logoCatalogSyncDecision({
      nowMs,
      lastSuccessfulSeason: '2026-07-01',
      watchSeason: null,
    }).reason,
    'watch_outdated',
  )
  assert.equal(
    logoCatalogSyncDecision({
      nowMs,
      lastSuccessfulSeason: '2026-07-01',
      watchSeason: '2026-07-01',
    }).required,
    false,
  )
  assert.equal(
    logoCatalogSyncDecision({
      nowMs,
      lastSuccessfulSeason: '2026-07-01',
      plannedSeason: '2026-07-01',
      catalogAssetVersion: 1,
      watchSeason: '2026-07-01',
    }).reason,
    'asset_upgrade',
  )
})

test('manifest contains both leagues and clear opaque 82px logo URLs', () => {
  const manifest = buildLogoCatalogManifest({
    season: '2026-07-01',
    generatedAt: 123,
    teamsByLeague: {
      'eng.1': [team('359', 'Arsenal', 'eng.1')],
      'esp.1': [team('83', 'Barcelona', 'esp.1')],
    },
  })

  assert.equal(manifest.totalTeams, 2)
  assert.equal(manifest.assetVersion, LOGO_CATALOG_ASSET_VERSION)
  assert.equal(manifest.downloadableLogos, 2)
  assert.deepEqual(manifest.leagues.map((league) => league.code), [
    'eng.1',
    'esp.1',
  ])
  for (const entry of manifest.teams) {
    const url = new URL(entry.logoUrl)
    assert.equal(url.searchParams.get('w'), '82')
    assert.equal(url.searchParams.get('h'), '82')
    assert.equal(url.searchParams.get('cquality'), '100')
    assert.equal(url.searchParams.get('transparent'), 'false')
    assert.equal(url.searchParams.get('background'), '#141414')
  }
  assert.equal(resizeEspnLogoUrl('http://example.com/a.png'), null)
})

test('seasonal planner fetches once and reuses its pending manifest', async () => {
  const settings = memorySettings()
  const sideService = { settings }
  const calls = []
  const fetchTeams = async (_sideService, leagueCode) => {
    calls.push(leagueCode)
    return leagueCode === 'eng.1'
      ? [team('359', 'Arsenal', leagueCode)]
      : [team('83', 'Barcelona', leagueCode)]
  }
  const options = {
    nowMs: Date.UTC(2026, 6, 2),
    firstInstall: true,
    fetchTeams,
  }

  const first = await planSeasonalLogoCatalog(sideService, options)
  const second = await planSeasonalLogoCatalog(sideService, options)

  assert.equal(first.reused, false)
  assert.equal(second.reused, true)
  assert.equal(first.manifest.totalTeams, 2)
  assert.deepEqual(calls.sort(), ['eng.1', 'esp.1'])
  assert.equal(
    readLogoCatalogState(settings).status,
    'manifest_ready',
  )
  assert.ok(settings.getItem(LOGO_CATALOG_STATE_KEY))
})

test('seasonal planner replaces an old asset manifest in the same season', async () => {
  const settings = memorySettings()
  const sideService = { settings }
  settings.setItem(
    LOGO_CATALOG_STATE_KEY,
    JSON.stringify({
      status: 'active',
      lastSuccessfulSeason: '2026-07-01',
      manifest: {
        season: '2026-07-01',
        assetVersion: 1,
        totalTeams: 2,
        teams: [],
      },
      stagedSeason: '2026-07-01',
      stagedAssets: { old: { filePath: 'old.tga' } },
    }),
  )

  const result = await planSeasonalLogoCatalog(sideService, {
    nowMs: Date.UTC(2026, 6, 2),
    watchSeason: '2026-07-01',
    fetchTeams: async (_service, leagueCode) =>
      leagueCode === 'eng.1'
        ? [team('359', 'Arsenal', leagueCode)]
        : [team('83', 'Barcelona', leagueCode)],
  })

  const state = readLogoCatalogState(settings)
  assert.equal(result.reason, 'asset_upgrade')
  assert.equal(state.manifest.assetVersion, LOGO_CATALOG_ASSET_VERSION)
  assert.equal(state.stagedSeason, null)
  assert.deepEqual(state.stagedAssets, {})
})

test('seasonal planner records failure without a successful manifest', async () => {
  const settings = memorySettings()
  const sideService = { settings }

  await assert.rejects(
    planSeasonalLogoCatalog(sideService, {
      nowMs: Date.UTC(2026, 6, 2),
      fetchTeams: async () => {
        throw new Error('offline')
      },
    }),
    /offline/,
  )

  const state = readLogoCatalogState(settings)
  assert.equal(state.status, 'failed')
  assert.equal(state.lastError, 'offline')
  assert.equal(state.manifest, undefined)
})
