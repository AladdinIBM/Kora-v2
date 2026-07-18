export const LEAGUES = Object.freeze([
  Object.freeze({
    code: 'eng.1',
    name: 'Premier League',
    country: 'England',
    abbreviation: 'PL',
    localLogoPath: 'premier-league.png',
    accentColor: '7A263A',
  }),
  Object.freeze({
    code: 'esp.1',
    name: 'La Liga',
    country: 'Spain',
    abbreviation: 'LL',
    localLogoPath: 'la-liga.png',
    accentColor: 'FF4B44',
  }),
])

export const ESPN_BASE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer'

export const ESPN_ENDPOINTS = Object.freeze({
  teams(leagueCode) {
    return `${ESPN_BASE_URL}/${leagueCode}/teams`
  },
  team(teamId) {
    return `${ESPN_BASE_URL}/all/teams/${teamId}`
  },
  schedule(teamId) {
    return `${ESPN_BASE_URL}/all/teams/${teamId}/schedule?fixture=true`
  },
})

export const FIXTURE_STATUSES = Object.freeze([
  'scheduled',
  'live',
  'halftime',
  'finished',
  'postponed',
  'suspended',
  'cancelled',
])

export const ERROR_CODES = Object.freeze({
  PHONE_DISCONNECTED: 'PHONE_DISCONNECTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  HTTP_ERROR: 'HTTP_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
})

export const STORAGE_SCHEMA_VERSION = 1
export const FIXTURE_CACHE_TTL_MS = 6 * 60 * 60 * 1000
export const LEAGUE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const NEAR_KICKOFF_WINDOW_MS = 3 * 60 * 60 * 1000
export const LOGICAL_TIMEOUT_MS = 8 * 1000
export const DEVICE_REQUEST_TIMEOUT_MS = LOGICAL_TIMEOUT_MS + 4 * 1000
export const MANUAL_REFRESH_COOLDOWN_MS = 2 * 1000
export const LIVE_POLL_INTERVAL_MS = 30 * 1000
export const SUSPENDED_POLL_INTERVAL_MS = 5 * 60 * 1000
export const MAX_UPCOMING_FIXTURES = 5
export const MAX_DYNAMIC_LOGOS = 50

export const ASSETS = Object.freeze({
  fallbackCrest: 'neutral-crest.png',
  appIcon: 'icon.png',
})

export const COLORS = Object.freeze({
  background: 0x000000,
  surfacePrimary: 0x141414,
  surfaceSecondary: 0x101010,
  textPrimary: 0xffffff,
  textMuted: 0x8e8e93,
  live: 0xff3b30,
  halftime: 0xff9f0a,
  warning: 0xffd60a,
  fallbackAccent: 0x3b82f6,
  destructive: 0xff453a,
})

export const STORAGE_KEYS = Object.freeze({
  schemaVersion: 'clubPulse.schemaVersion',
  selectedLeague: 'clubpulse.selectedLeague',
  selectedTeam: 'clubpulse.selectedTeam',
  followedTeams: 'clubPulse.followedTeams',
  lastViewedTeamId: 'clubPulse.lastViewedTeamId',
  logoIndex: 'clubPulse.logoIndex',
  lastSyncAt: 'clubPulse.lastSyncAt',
  leagueCache(leagueCode) {
    return `clubPulse.leagueCache.${leagueCode}`
  },
  fixtureCache(teamId) {
    return `clubPulse.fixtureCache.${teamId}`
  },
})
