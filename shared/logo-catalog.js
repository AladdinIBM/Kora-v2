import { LEAGUES } from './constants.js'
import { asArray, asString } from './validation.js'

export const LOGO_CATALOG_SCHEMA_VERSION = 1
export const LOGO_CATALOG_ASSET_VERSION = 2
export const LOGO_CATALOG_IMAGE_SIZE = 82
export const LOGO_CATALOG_IMAGE_BACKGROUND = '#141414'

function validTimestamp(value) {
  const timestamp = Number(value)
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

export function logoCatalogSeason(nowMs = Date.now()) {
  const now = new Date(validTimestamp(nowMs))
  const year = now.getFullYear()
  const julyFirst = new Date(year, 6, 1).getTime()
  const seasonYear = now.getTime() >= julyFirst ? year : year - 1
  return `${seasonYear}-07-01`
}

export function logoCatalogSyncDecision({
  nowMs = Date.now(),
  lastSuccessfulSeason = null,
  plannedSeason = null,
  catalogAssetVersion = LOGO_CATALOG_ASSET_VERSION,
  watchSeason,
  firstInstall = false,
  force = false,
} = {}) {
  const season = logoCatalogSeason(nowMs)
  const phoneCurrent = String(lastSuccessfulSeason || '') === season
  const planCurrent = String(plannedSeason || '') === season
  const assetsCurrent =
    Number(catalogAssetVersion) === LOGO_CATALOG_ASSET_VERSION
  const watchWasReported = watchSeason !== undefined
  const watchCurrent = String(watchSeason || '') === season

  let reason = 'current'
  if (force) reason = 'forced'
  else if (firstInstall) reason = 'first_install'
  else if (!assetsCurrent) reason = 'asset_upgrade'
  else if (!phoneCurrent && !planCurrent) reason = 'season_due'
  else if (watchWasReported && !watchCurrent) reason = 'watch_outdated'

  const required = reason !== 'current'
  return {
    season,
    reason,
    required,
    refreshManifest:
      force || !assetsCurrent || (!phoneCurrent && !planCurrent),
  }
}

export function resizeEspnLogoUrl(
  value,
  size = LOGO_CATALOG_IMAGE_SIZE,
) {
  const source = asString(value)
  const dimension = Number(size)
  if (!source || !Number.isInteger(dimension) || dimension < 1 || dimension > 128) {
    return null
  }

  try {
    const url = new URL(source)
    if (url.protocol !== 'https:') return null
    url.searchParams.set('w', String(dimension))
    url.searchParams.set('h', String(dimension))
    url.searchParams.set('scale', 'crop')
    url.searchParams.set('cquality', '100')
    url.searchParams.set('location', 'origin')
    url.searchParams.set('transparent', 'false')
    url.searchParams.set('background', LOGO_CATALOG_IMAGE_BACKGROUND)
    return url.toString()
  } catch {
    return null
  }
}

export function buildLogoCatalogManifest({
  season,
  generatedAt = Date.now(),
  teamsByLeague,
}) {
  if (!/^\d{4}-07-01$/.test(String(season || ''))) {
    throw new Error('Logo catalog season must use YYYY-07-01')
  }

  const seen = new Set()
  const teams = []
  const leagues = []

  for (const league of LEAGUES) {
    const leagueTeams = asArray(teamsByLeague && teamsByLeague[league.code])
    if (!leagueTeams.length) {
      throw new Error(`Logo catalog has no teams for ${league.code}`)
    }

    const teamIds = []
    for (const team of leagueTeams) {
      const id = asString(team && team.id)
      const name = asString(team && (team.name || team.displayName))
      if (!id || !name || seen.has(id)) continue
      seen.add(id)
      teamIds.push(id)
      teams.push({
        id,
        name,
        shortName: asString(team.shortName || team.shortDisplayName || name),
        abbreviation: asString(team.abbreviation || '—'),
        leagueCode: league.code,
        logoUrl: resizeEspnLogoUrl(team.logoUrl || team.logo),
      })
    }

    if (!teamIds.length) {
      throw new Error(`Logo catalog has no valid teams for ${league.code}`)
    }
    leagues.push({
      code: league.code,
      name: league.name,
      teamIds,
    })
  }

  teams.sort(
    (first, second) =>
      first.leagueCode.localeCompare(second.leagueCode) ||
      first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }),
  )

  return {
    schemaVersion: LOGO_CATALOG_SCHEMA_VERSION,
    assetVersion: LOGO_CATALOG_ASSET_VERSION,
    season,
    generatedAt: validTimestamp(generatedAt),
    totalTeams: teams.length,
    downloadableLogos: teams.filter((team) => team.logoUrl).length,
    leagues,
    teams,
  }
}

export function logoCatalogAssetRevision(season, teamId) {
  return `${season}-v${LOGO_CATALOG_ASSET_VERSION}-${teamId}`
}
