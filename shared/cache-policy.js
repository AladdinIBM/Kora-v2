import {
  FIXTURE_CACHE_TTL_MS,
  LEAGUE_CACHE_TTL_MS,
  NEAR_KICKOFF_WINDOW_MS,
} from './constants.js'
import { localDateKey } from './match-selector.js'

function validFetchedAt(cache) {
  return cache && Number.isFinite(Number(cache.fetchedAt))
    ? Number(cache.fetchedAt)
    : 0
}

export function isCacheFresh(
  cache,
  nowMs = Date.now(),
  ttlMs = FIXTURE_CACHE_TTL_MS,
) {
  const fetchedAt = validFetchedAt(cache)
  return fetchedAt > 0 && nowMs >= fetchedAt && nowMs - fetchedAt < ttlMs
}

export function isLeagueCacheFresh(cache, nowMs = Date.now()) {
  return isCacheFresh(cache, nowMs, LEAGUE_CACHE_TTL_MS)
}

export function isNearKickoff(
  primaryFixture,
  nowMs = Date.now(),
  windowMs = NEAR_KICKOFF_WINDOW_MS,
) {
  if (!primaryFixture || primaryFixture.status !== 'scheduled') {
    return false
  }
  const kickoff = Date.parse(primaryFixture.startTimeUtc)
  return Number.isFinite(kickoff) && Math.abs(kickoff - nowMs) <= windowMs
}

export function fixtureRefreshReason(cache, options = {}) {
  const nowMs = options.nowMs ?? Date.now()
  const getDateKey = options.getDateKey || localDateKey
  if (options.manual === true) {
    return 'manual'
  }
  if (!cache) {
    return 'missing'
  }
  if (!cache.primaryFixture) {
    return isCacheFresh(cache, nowMs) ? null : 'stale'
  }
  if (
    cache.primaryFixture.status === 'live' ||
    cache.primaryFixture.status === 'halftime'
  ) {
    return 'live'
  }
  if (
    cache.primaryFixture.status === 'finished' &&
    getDateKey(Date.parse(cache.primaryFixture.startTimeUtc)) !==
      getDateKey(nowMs)
  ) {
    return 'day-rollover'
  }
  if (isNearKickoff(cache.primaryFixture, nowMs)) {
    return 'near-kickoff'
  }
  if (!isCacheFresh(cache, nowMs)) {
    return 'stale'
  }
  return null
}

export function shouldRefreshFixtureCache(cache, options = {}) {
  return fixtureRefreshReason(cache, options) !== null
}

export function rollFixtureCacheForward(
  cache,
  nowMs = Date.now(),
  getDateKey = localDateKey,
) {
  if (
    !cache ||
    !cache.primaryFixture ||
    cache.primaryFixture.status !== 'finished' ||
    getDateKey(Date.parse(cache.primaryFixture.startTimeUtc)) ===
      getDateKey(nowMs)
  ) {
    return cache
  }

  const upcoming = Array.isArray(cache.upcomingFixtures)
    ? cache.upcomingFixtures
    : []
  const nextIndex = upcoming.findIndex(
    (fixture) =>
      fixture?.status === 'scheduled' &&
      Date.parse(fixture.startTimeUtc) > nowMs,
  )
  if (nextIndex < 0) {
    return {
      ...cache,
      primaryFixture: null,
      upcomingFixtures: [],
    }
  }
  return {
    ...cache,
    primaryFixture: upcoming[nextIndex],
    upcomingFixtures: upcoming.slice(nextIndex + 1),
  }
}
