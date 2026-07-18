import {
  ERROR_CODES,
  ESPN_ENDPOINTS,
  LEAGUES,
  LOGICAL_TIMEOUT_MS,
} from '../shared/constants.js'
import { ClubPulseError } from '../shared/errors.js'
import { ESPNAdapter } from '../shared/espn-adapter.js'
import {
  localDateKeyAtOffset,
  selectSchedulePayload,
} from '../shared/match-selector.js'

function assertHttpSuccess(response) {
  const status = Number(response && response.status)
  if (!Number.isFinite(status) || status < 200 || status >= 300) {
    throw new ClubPulseError(
      ERROR_CODES.HTTP_ERROR,
      `ESPN returned HTTP ${Number.isFinite(status) ? status : 'unknown'}`,
      { status },
    )
  }
  return response.body
}

export async function fetchEspnBody(sideService, url) {
  const response = await sideService.fetch({
    url,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    timeout: LOGICAL_TIMEOUT_MS,
  })
  return assertHttpSuccess(response)
}

export async function fetchLeagueTeams(sideService, leagueCode) {
  if (!LEAGUES.some((league) => league.code === leagueCode)) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      `Unsupported league code: ${leagueCode}`,
    )
  }
  const body = await fetchEspnBody(
    sideService,
    ESPN_ENDPOINTS.teams(leagueCode),
  )
  return ESPNAdapter.normalizeTeams(body, leagueCode)
}

export async function fetchTeam(sideService, teamId, leagueCode = '') {
  const body = await fetchEspnBody(sideService, ESPN_ENDPOINTS.team(teamId))
  return ESPNAdapter.normalizeTeam(body, leagueCode)
}

export async function fetchScheduleSelection(
  sideService,
  {
    teamId,
    nowMs = Date.now(),
    timezoneOffsetMinutes = -new Date().getTimezoneOffset(),
  },
) {
  const body = await fetchEspnBody(
    sideService,
    ESPN_ENDPOINTS.schedule(teamId),
  )
  const fixtures = ESPNAdapter.normalizeSchedule(body)
  const offset = Number(timezoneOffsetMinutes)
  const safeOffset = Number.isFinite(offset) && Math.abs(offset) <= 14 * 60
    ? offset
    : 0
  const dateKey = (timestampMs) =>
    localDateKeyAtOffset(timestampMs, safeOffset)
  return selectSchedulePayload(String(teamId), fixtures, Number(nowMs), dateKey)
}
