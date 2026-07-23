import {
  ERROR_CODES,
  LOGICAL_TIMEOUT_MS,
} from '../shared/constants.js'
import { ClubPulseError } from '../shared/errors.js'
import {
  LOGO_CATALOG_ASSET_VERSION,
  logoCatalogAssetRevision,
} from '../shared/logo-catalog.js'
import {
  planSeasonalLogoCatalog,
  readLogoCatalogState,
  writeLogoCatalogState,
} from './logo-catalog-service.js'

const DOWNLOAD_CONCURRENCY = 1
const LOGO_DOWNLOAD_TIMEOUT_MS = 30 * 1000
let activeJob = null

function safeSegment(value, label) {
  const segment = String(value || '')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(segment)) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      `Invalid ${label} in logo catalog`,
    )
  }
  return segment
}

function downloadFile(sideService, url) {
  return new Promise((resolve, reject) => {
    let task
    try {
      task = sideService.download(url, {
        timeout: Math.max(LOGICAL_TIMEOUT_MS, LOGO_DOWNLOAD_TIMEOUT_MS),
        headers: {
          Accept: 'image/png,image/*',
        },
      })
    } catch (error) {
      reject(
        new ClubPulseError(
          ERROR_CODES.NETWORK_ERROR,
          String((error && error.message) || error || 'Logo download failed'),
        ),
      )
      return
    }
    if (!task || typeof task !== 'object') {
      reject(
        new ClubPulseError(
          ERROR_CODES.NETWORK_ERROR,
          'Logo downloader did not return a download task',
        ),
      )
      return
    }
    task.onSuccess = (event) => {
      const status = Number(event && event.statusCode)
      const filePath = event && (event.filePath || event.tempFilePath)
      if (status >= 200 && status < 300 && filePath) {
        resolve(filePath)
        return
      }
      reject(
        new ClubPulseError(
          ERROR_CODES.HTTP_ERROR,
          `Logo download returned HTTP ${Number.isFinite(status) ? status : 'unknown'}`,
        ),
      )
    }
    task.onFail = (event) => {
      reject(
        new ClubPulseError(
          ERROR_CODES.NETWORK_ERROR,
          (event && event.message) || 'Logo download failed',
        ),
      )
    }
  })
}

export function phoneLogoSlot(
  season,
  assetVersion = LOGO_CATALOG_ASSET_VERSION,
) {
  const safeSeason = safeSegment(season, 'season')
  const year = Number(safeSeason.slice(0, 4))
  if (!/^\d{4}-07-01$/.test(safeSeason) || !Number.isFinite(year)) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      'Invalid season in logo catalog',
    )
  }
  const version = Number(assetVersion)
  if (!Number.isInteger(version) || version < 1) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      'Invalid asset version in logo catalog',
    )
  }
  return (year + version - 1) % 2 === 0 ? 'a' : 'b'
}

export function phoneLogoTargetPath(season, teamId) {
  const slot = phoneLogoSlot(season)
  const safeTeamId = safeSegment(teamId, 'team ID')
  return `data://download/clubpulse-logo-${slot}-${safeTeamId}.tga`
}

export async function downloadAndConvertCatalogLogo(
  sideService,
  { season, team },
) {
  if (!team || !team.logoUrl) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      `Logo URL is missing for team ${team && team.id}`,
    )
  }

  const sourcePath = await downloadFile(sideService, team.logoUrl)
  const targetFilePath = phoneLogoTargetPath(season, team.id)
  const result = await sideService.convert({
    filePath: sourcePath,
    targetFilePath,
  })
  const convertedPath = result && result.targetFilePath
  const byteLength = Number(result && result.options && result.options.size)
  if (!convertedPath || !Number.isFinite(byteLength) || byteLength <= 0) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      `Logo conversion failed for team ${team.id}`,
    )
  }

  return {
    teamId: String(team.id),
    filePath: convertedPath,
    byteLength,
    revision: logoCatalogAssetRevision(season, team.id),
    readyAt: Date.now(),
  }
}

function publicStatus(state) {
  const assets = state.stagedAssets || {}
  const failedTeamIds = Array.isArray(state.failedTeamIds)
    ? state.failedTeamIds
    : []
  return {
    status: state.status || 'idle',
    season:
      state.stagedSeason ||
      state.targetSeason ||
      (state.manifest && state.manifest.season) ||
      null,
    totalTeams: Number(state.manifest && state.manifest.totalTeams) || 0,
    readyLogos: Object.keys(assets).length,
    failedTeamIds,
    lastError: state.lastError || null,
  }
}

export function getLogoCatalogDownloadStatus(settings) {
  return publicStatus(readLogoCatalogState(settings))
}

export async function stageSeasonalLogoCatalog(
  sideService,
  {
    manifest,
    concurrency = DOWNLOAD_CONCURRENCY,
    stageLogo = downloadAndConvertCatalogLogo,
  } = {},
) {
  const state = readLogoCatalogState(sideService.settings)
  const catalog = manifest || state.manifest
  if (!catalog || !catalog.season || !Array.isArray(catalog.teams)) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      'Logo catalog manifest is not ready',
    )
  }

  const sameSeason = state.stagedSeason === catalog.season
  const stagedAssets = sameSeason ? { ...(state.stagedAssets || {}) } : {}
  const queue = catalog.teams.filter(
    (team) => !stagedAssets[String(team.id)],
  )
  const failures = []
  const workerCount = Math.max(
    1,
    Math.min(Number(concurrency) || DOWNLOAD_CONCURRENCY, queue.length || 1),
  )
  let cursor = 0

  writeLogoCatalogState(sideService.settings, {
    ...state,
    status: 'downloading',
    stagedSeason: catalog.season,
    stagedAssets,
    failedTeamIds: [],
    lastError: null,
  })

  async function worker() {
    while (cursor < queue.length) {
      const team = queue[cursor]
      cursor += 1
      try {
        const asset = await stageLogo(sideService, {
          season: catalog.season,
          team,
        })
        stagedAssets[String(team.id)] = asset
      } catch (error) {
        failures.push({
          teamId: String(team.id),
          message: String((error && error.message) || error || 'Unknown error'),
        })
      }

      writeLogoCatalogState(sideService.settings, {
        ...readLogoCatalogState(sideService.settings),
        status: 'downloading',
        stagedSeason: catalog.season,
        stagedAssets,
        failedTeamIds: failures.map((failure) => failure.teamId),
      })
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker))

  if (failures.length) {
    const firstFailure = failures[0]
    const message =
      `Failed to prepare ${failures.length} logo(s)` +
      (firstFailure && firstFailure.message
        ? `: ${firstFailure.message}`
        : '')
    writeLogoCatalogState(sideService.settings, {
      ...readLogoCatalogState(sideService.settings),
      status: 'download_failed',
      stagedSeason: catalog.season,
      stagedAssets,
      failedTeamIds: failures.map((failure) => failure.teamId),
      lastError: message,
    })
    throw new ClubPulseError(ERROR_CODES.NETWORK_ERROR, message, { failures })
  }

  const completedState = writeLogoCatalogState(sideService.settings, {
    ...readLogoCatalogState(sideService.settings),
    status: 'staged',
    stagedSeason: catalog.season,
    stagedAssets,
    failedTeamIds: [],
    stagedAt: Date.now(),
    lastError: null,
  })
  return publicStatus(completedState)
}

export function runSeasonalLogoCatalogJob(sideService, options = {}) {
  if (activeJob) return activeJob

  activeJob = (async () => {
    const plan = await planSeasonalLogoCatalog(sideService, options)
    const state = readLogoCatalogState(sideService.settings)
    if (
      state.stagedSeason === plan.season &&
      Object.keys(state.stagedAssets || {}).length ===
        Number(plan.manifest && plan.manifest.totalTeams)
    ) {
      return publicStatus(state)
    }
    return stageSeasonalLogoCatalog(sideService, {
      manifest: plan.manifest,
    })
  })().finally(() => {
    activeJob = null
  })

  return activeJob
}
