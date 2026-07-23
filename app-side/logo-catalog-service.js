import { LEAGUES } from '../shared/constants.js'
import {
  buildLogoCatalogManifest,
  LOGO_CATALOG_ASSET_VERSION,
  logoCatalogSyncDecision,
} from '../shared/logo-catalog.js'
import { fetchLeagueTeams } from './espn-client.js'

export const LOGO_CATALOG_STATE_KEY = 'clubPulse.logoCatalog.syncState'

function parseState(value) {
  if (!value) return {}
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function readLogoCatalogState(settings) {
  return parseState(settings.getItem(LOGO_CATALOG_STATE_KEY))
}

export function writeLogoCatalogState(settings, state) {
  settings.setItem(LOGO_CATALOG_STATE_KEY, JSON.stringify(state))
  return state
}

export function markLogoCatalogActivated(
  sideService,
  { season, totalTeams, nowMs = Date.now() } = {},
) {
  const state = readLogoCatalogState(sideService.settings)
  const normalizedSeason = String(season || '')
  const expectedTotal = Number(state.manifest && state.manifest.totalTeams) || 0
  const stagedTotal = Object.keys(state.stagedAssets || {}).length
  if (
    !/^\d{4}-07-01$/.test(normalizedSeason) ||
    state.stagedSeason !== normalizedSeason ||
    state.manifest?.season !== normalizedSeason ||
    expectedTotal <= 0 ||
    Number(totalTeams) !== expectedTotal ||
    stagedTotal !== expectedTotal
  ) {
    throw new Error('Watch activation does not match the staged logo catalog')
  }

  return writeLogoCatalogState(sideService.settings, {
    ...state,
    status: 'active',
    activeSeason: normalizedSeason,
    lastSuccessfulSeason: normalizedSeason,
    transferCompleted: expectedTotal,
    activatedAt: Number(nowMs) || Date.now(),
    lastError: null,
  })
}

export async function planSeasonalLogoCatalog(
  sideService,
  {
    nowMs = Date.now(),
    watchSeason,
    firstInstall = false,
    force = false,
    fetchTeams = fetchLeagueTeams,
  } = {},
) {
  const state = readLogoCatalogState(sideService.settings)
  const decision = logoCatalogSyncDecision({
    nowMs,
    lastSuccessfulSeason: state.lastSuccessfulSeason,
    plannedSeason: state.manifest && state.manifest.season,
    catalogAssetVersion:
      Number(state.manifest && state.manifest.assetVersion) || 0,
    watchSeason,
    firstInstall,
    force,
  })

  if (!decision.required) {
    return {
      ...decision,
      status: state.status || 'current',
      manifest: state.manifest || null,
    }
  }

  if (!decision.refreshManifest && state.manifest) {
    return {
      ...decision,
      status: 'manifest_ready',
      reused: true,
      manifest: state.manifest,
    }
  }

  const startedAt = Date.now()
  writeLogoCatalogState(sideService.settings, {
    ...state,
    status: 'planning',
    targetSeason: decision.season,
    lastAttemptAt: startedAt,
    lastError: null,
  })

  try {
    const results = await Promise.all(
      LEAGUES.map(async (league) => [
        league.code,
        await fetchTeams(sideService, league.code),
      ]),
    )
    const manifest = buildLogoCatalogManifest({
      season: decision.season,
      generatedAt: Date.now(),
      teamsByLeague: Object.fromEntries(results),
    })
    const keepExistingStage =
      !force &&
      state.manifest &&
      state.manifest.season === decision.season &&
      Number(state.manifest.assetVersion) === LOGO_CATALOG_ASSET_VERSION
    writeLogoCatalogState(sideService.settings, {
      ...state,
      status: 'manifest_ready',
      targetSeason: decision.season,
      manifest,
      stagedSeason: keepExistingStage ? state.stagedSeason : null,
      stagedAssets: keepExistingStage ? state.stagedAssets || {} : {},
      lastAttemptAt: startedAt,
      lastError: null,
    })
    return {
      ...decision,
      status: 'manifest_ready',
      reused: false,
      manifest,
    }
  } catch (error) {
    writeLogoCatalogState(sideService.settings, {
      ...state,
      status: 'failed',
      targetSeason: decision.season,
      lastAttemptAt: startedAt,
      lastError: String((error && error.message) || error || 'Unknown error'),
    })
    throw error
  }
}
