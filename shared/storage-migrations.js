import {
  LEAGUES,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
} from './constants.js'
import { asArray, isObject, stableUniqueBy } from './validation.js'

export function safeParseJson(rawValue, fallback) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallback
  }
  if (typeof rawValue !== 'string') {
    return isObject(rawValue) || Array.isArray(rawValue) ? rawValue : fallback
  }
  try {
    return JSON.parse(rawValue)
  } catch {
    return fallback
  }
}

export function normalizeFollowedTeams(value) {
  return stableUniqueBy(
    asArray(value).filter(
      (team) =>
        isObject(team) &&
        typeof team.id === 'string' &&
        team.id.length > 0 &&
        typeof team.name === 'string' &&
        team.name.length > 0,
    ),
    (team) => team.id,
  )
}

export function migrateStorageSnapshot(snapshot = {}) {
  const source = isObject(snapshot) ? snapshot : {}
  const sourceVersion = Number(source.schemaVersion) || 0

  if (sourceVersion > STORAGE_SCHEMA_VERSION) {
    return {
      schemaVersion: sourceVersion,
      followedTeams: normalizeFollowedTeams(source.followedTeams),
      lastViewedTeamId:
        typeof source.lastViewedTeamId === 'string'
          ? source.lastViewedTeamId
          : null,
    }
  }

  const followedTeams = normalizeFollowedTeams(source.followedTeams)
  const validLastViewed = followedTeams.some(
    (team) => team.id === String(source.lastViewedTeamId || ''),
  )

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    followedTeams,
    lastViewedTeamId: validLastViewed
      ? String(source.lastViewedTeamId)
      : followedTeams[0]?.id || null,
  }
}

export function storageKeysForReset(teamIds = []) {
  return [
    STORAGE_KEYS.schemaVersion,
    STORAGE_KEYS.selectedLeague,
    STORAGE_KEYS.selectedTeam,
    STORAGE_KEYS.followedTeams,
    STORAGE_KEYS.lastViewedTeamId,
    STORAGE_KEYS.logoIndex,
    STORAGE_KEYS.logoCatalogTransfer,
    STORAGE_KEYS.logoCatalogActive,
    STORAGE_KEYS.logoSyncStatus,
    STORAGE_KEYS.lastSyncAt,
    ...LEAGUES.map((league) => STORAGE_KEYS.leagueCache(league.code)),
    ...[...new Set(teamIds.map(String))].map((teamId) =>
      STORAGE_KEYS.fixtureCache(teamId),
    ),
  ]
}
