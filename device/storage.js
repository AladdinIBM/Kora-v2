import { rmSync } from '@zos/fs'
import { LocalStorage } from '@zos/storage'
import { BUNDLED_TEAMS } from '../shared/bundled-teams.js'
import {
  LEAGUES,
  MAX_DYNAMIC_LOGOS,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
} from '../shared/constants.js'
import { planLogoEvictions, normalizeLogoIndex } from '../shared/logo-cache.js'
import {
  migrateStorageSnapshot,
  safeParseJson,
  storageKeysForReset,
} from '../shared/storage-migrations.js'
import {
  addFollowedTeam,
  removeFollowedTeam,
  resolveLaunchTeam,
} from '../shared/team-state.js'
import { normalizeSelectedTeam } from '../shared/team-selection.js'

const storage = new LocalStorage()
const bundledById = new Map(BUNDLED_TEAMS.map((team) => [team.id, team]))

function serialize(value) {
  return JSON.stringify(value)
}

function readJson(key, fallback) {
  return safeParseJson(storage.getItem(key, null), fallback)
}

function writeJsonIfChanged(key, value) {
  const serialized = serialize(value)
  if (storage.getItem(key, null) !== serialized) {
    storage.setItem(key, serialized)
  }
}

function removeDataFile(localPath) {
  if (!localPath || !String(localPath).startsWith('data://')) {
    return
  }
  try {
    rmSync(String(localPath).replace(/^data:\/\//, ''))
  } catch (error) {
    console.log(`[ClubPulse] unable to remove dynamic logo: ${error.message}`)
  }
}

export function initializeStorage() {
  const snapshot = migrateStorageSnapshot({
    schemaVersion: Number(storage.getItem(STORAGE_KEYS.schemaVersion, 0)),
    followedTeams: readJson(STORAGE_KEYS.followedTeams, []),
    lastViewedTeamId: storage.getItem(STORAGE_KEYS.lastViewedTeamId, null),
  })

  storage.setItem(STORAGE_KEYS.schemaVersion, snapshot.schemaVersion)
  writeJsonIfChanged(STORAGE_KEYS.followedTeams, snapshot.followedTeams)
  if (snapshot.lastViewedTeamId) {
    storage.setItem(STORAGE_KEYS.lastViewedTeamId, snapshot.lastViewedTeamId)
  } else {
    storage.removeItem(STORAGE_KEYS.lastViewedTeamId)
  }
  return snapshot
}

export function getFollowedTeams() {
  return migrateStorageSnapshot({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    followedTeams: readJson(STORAGE_KEYS.followedTeams, []),
    lastViewedTeamId: getLastViewedTeamId(),
  }).followedTeams.map(resolveTeamLogo)
}

export function getLastViewedTeamId() {
  const value = storage.getItem(STORAGE_KEYS.lastViewedTeamId, null)
  return typeof value === 'string' && value ? value : null
}

export function setLastViewedTeamId(teamId) {
  if (teamId === null || teamId === undefined || teamId === '') {
    storage.removeItem(STORAGE_KEYS.lastViewedTeamId)
    return
  }
  storage.setItem(STORAGE_KEYS.lastViewedTeamId, String(teamId))
}

export function getSelectedLeagueCode() {
  const value = storage.getItem(STORAGE_KEYS.selectedLeague, null)
  return LEAGUES.some((league) => league.code === value) ? value : null
}

export function setSelectedLeagueCode(leagueCode) {
  const normalized = String(leagueCode || '')
  if (!LEAGUES.some((league) => league.code === normalized)) {
    storage.removeItem(STORAGE_KEYS.selectedLeague)
    return
  }
  storage.setItem(STORAGE_KEYS.selectedLeague, normalized)
}

export function getSelectedTeam() {
  return normalizeSelectedTeam(readJson(STORAGE_KEYS.selectedTeam, null))
}

export function setSelectedTeam(team) {
  const normalized = normalizeSelectedTeam(team)
  if (!normalized) {
    storage.removeItem(STORAGE_KEYS.selectedTeam)
    return null
  }
  writeJsonIfChanged(STORAGE_KEYS.selectedTeam, normalized)
  return normalized
}

export function getLaunchRouteState() {
  const followedTeams = getFollowedTeams()
  const resolved = resolveLaunchTeam(followedTeams, getLastViewedTeamId())
  if (resolved.repairedLastViewedTeamId) {
    setLastViewedTeamId(resolved.repairedLastViewedTeamId)
  }
  return resolved
}

export function followTeam(team) {
  const followedTeams = addFollowedTeam(getFollowedTeams(), resolveTeamLogo(team))
  writeJsonIfChanged(STORAGE_KEYS.followedTeams, followedTeams)
  setLastViewedTeamId(team.id)
  return followedTeams
}

export function unfollowTeam(teamId) {
  const result = removeFollowedTeam(
    getFollowedTeams(),
    teamId,
    getLastViewedTeamId(),
  )
  writeJsonIfChanged(STORAGE_KEYS.followedTeams, result.followedTeams)
  setLastViewedTeamId(result.lastViewedTeamId)
  storage.removeItem(STORAGE_KEYS.fixtureCache(teamId))
  cleanUnreferencedDynamicLogos()
  return result
}

export function getTeam(teamId) {
  const normalizedId = String(teamId)
  return (
    getFollowedTeams().find((team) => team.id === normalizedId) ||
    resolveTeamLogo(bundledById.get(normalizedId)) ||
    null
  )
}

export function getBundledTeams(leagueCode) {
  return BUNDLED_TEAMS.filter((team) => team.leagueCode === leagueCode).map(
    resolveTeamLogo,
  )
}

export function getLeagueCache(leagueCode) {
  const cache = readJson(STORAGE_KEYS.leagueCache(leagueCode), null)
  if (!cache || !Array.isArray(cache.teams)) {
    return null
  }
  return {
    fetchedAt: Number(cache.fetchedAt) || 0,
    teams: cache.teams.map(resolveTeamLogo),
  }
}

export function setLeagueCache(leagueCode, teams, fetchedAt = Date.now()) {
  writeJsonIfChanged(STORAGE_KEYS.leagueCache(leagueCode), {
    leagueCode,
    fetchedAt,
    teams: teams.map(resolveTeamLogo),
  })
}

function resolveParticipantLogo(participant) {
  if (!participant) {
    return participant
  }
  const bundled = bundledById.get(String(participant.id))
  const logoIndex = getLogoIndex()
  const dynamic = logoIndex[String(participant.id)]
  return {
    ...participant,
    localLogoPath:
      (bundled && bundled.localLogoPath) ||
      (dynamic && dynamic.localPath) ||
      participant.localLogoPath ||
      null,
  }
}

function resolveFixtureLogos(fixture) {
  if (!fixture) {
    return null
  }
  return {
    ...fixture,
    homeTeam: resolveParticipantLogo(fixture.homeTeam),
    awayTeam: resolveParticipantLogo(fixture.awayTeam),
  }
}

export function getFixtureCache(teamId) {
  const cache = readJson(STORAGE_KEYS.fixtureCache(teamId), null)
  if (!cache || String(cache.teamId) !== String(teamId)) {
    return null
  }
  return {
    teamId: String(teamId),
    fetchedAt: Number(cache.fetchedAt) || 0,
    primaryFixture: resolveFixtureLogos(cache.primaryFixture),
    upcomingFixtures: Array.isArray(cache.upcomingFixtures)
      ? cache.upcomingFixtures.map(resolveFixtureLogos)
      : [],
  }
}

export function setFixtureCache(teamId, payload, fetchedAt = Date.now()) {
  if (
    !payload ||
    (payload.primaryFixture === undefined &&
      !Array.isArray(payload.upcomingFixtures))
  ) {
    return false
  }
  const cache = {
    teamId: String(teamId),
    fetchedAt,
    primaryFixture: resolveFixtureLogos(payload.primaryFixture || null),
    upcomingFixtures: Array.isArray(payload.upcomingFixtures)
      ? payload.upcomingFixtures.map(resolveFixtureLogos)
      : [],
  }
  writeJsonIfChanged(STORAGE_KEYS.fixtureCache(teamId), cache)
  storage.setItem(STORAGE_KEYS.lastSyncAt, fetchedAt)
  return true
}

export function getLastSyncAt() {
  return Number(storage.getItem(STORAGE_KEYS.lastSyncAt, 0)) || 0
}

export function getLogoIndex() {
  return normalizeLogoIndex(readJson(STORAGE_KEYS.logoIndex, {}))
}

export function resolveTeamLogo(team) {
  if (!team) {
    return null
  }
  const normalizedId = String(team.id)
  const bundled = bundledById.get(normalizedId)
  const dynamic = getLogoIndex()[normalizedId]
  return {
    ...team,
    id: normalizedId,
    localLogoPath:
      (bundled && bundled.localLogoPath) ||
      (dynamic && dynamic.localPath) ||
      team.localLogoPath ||
      null,
  }
}

export function registerDynamicLogo(teamId, sourceUrl, localPath) {
  const index = getLogoIndex()
  index[String(teamId)] = {
    sourceUrl,
    localPath,
    lastUsedAt: Date.now(),
    bundled: false,
  }
  writeJsonIfChanged(STORAGE_KEYS.logoIndex, index)
  applyLogoToFixtureCaches(String(teamId), localPath)
  enforceLogoLimit()
}

export function hasValidLocalLogo(teamId, sourceUrl) {
  const bundled = bundledById.get(String(teamId))
  if (bundled && bundled.localLogoPath) {
    return true
  }
  const dynamic = getLogoIndex()[String(teamId)]
  return Boolean(
    dynamic && dynamic.localPath && dynamic.sourceUrl === String(sourceUrl),
  )
}

function applyLogoToFixture(fixture, teamId, localPath) {
  if (!fixture) return fixture
  const update = (team) =>
    team && team.id === teamId ? { ...team, localLogoPath: localPath } : team
  return {
    ...fixture,
    homeTeam: update(fixture.homeTeam),
    awayTeam: update(fixture.awayTeam),
  }
}

function applyLogoToFixtureCaches(teamId, localPath) {
  for (const followedTeam of getFollowedTeams()) {
    const cache = getFixtureCache(followedTeam.id)
    if (!cache) continue
    const updated = {
      ...cache,
      primaryFixture: applyLogoToFixture(cache.primaryFixture, teamId, localPath),
      upcomingFixtures: cache.upcomingFixtures.map((fixture) =>
        applyLogoToFixture(fixture, teamId, localPath),
      ),
    }
    writeJsonIfChanged(STORAGE_KEYS.fixtureCache(followedTeam.id), updated)
  }
}

function referencedLogoTeamIds() {
  const ids = new Set(getFollowedTeams().map((team) => team.id))
  for (const league of LEAGUES) {
    const cache = getLeagueCache(league.code)
    for (const team of cache?.teams || []) {
      ids.add(team.id)
    }
  }
  for (const followedTeam of getFollowedTeams()) {
    const cache = getFixtureCache(followedTeam.id)
    const fixtures = [
      cache?.primaryFixture,
      ...(cache?.upcomingFixtures || []),
    ].filter(Boolean)
    for (const fixture of fixtures) {
      ids.add(fixture.homeTeam.id)
      ids.add(fixture.awayTeam.id)
    }
  }
  return ids
}

function enforceLogoLimit() {
  const index = getLogoIndex()
  const evictions = planLogoEvictions(
    index,
    [...referencedLogoTeamIds()],
    MAX_DYNAMIC_LOGOS,
  )
  for (const eviction of evictions) {
    removeDataFile(eviction.localPath)
    delete index[eviction.teamId]
  }
  writeJsonIfChanged(STORAGE_KEYS.logoIndex, index)
}

export function cleanUnreferencedDynamicLogos() {
  const protectedIds = referencedLogoTeamIds()
  const index = getLogoIndex()
  for (const [teamId, entry] of Object.entries(index)) {
    if (!protectedIds.has(teamId) && entry.bundled !== true) {
      removeDataFile(entry.localPath)
      delete index[teamId]
    }
  }
  writeJsonIfChanged(STORAGE_KEYS.logoIndex, index)
}

export function resetClubPulseStorage() {
  const followedTeams = getFollowedTeams()
  const logoIndex = getLogoIndex()
  for (const entry of Object.values(logoIndex)) {
    removeDataFile(entry.localPath)
  }
  for (const key of storageKeysForReset(
    followedTeams.map((team) => team.id),
  )) {
    storage.removeItem(key)
  }
}

export const storageInternals = Object.freeze({
  readJson,
  writeJsonIfChanged,
  removeDataFile,
})
