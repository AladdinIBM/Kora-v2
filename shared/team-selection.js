import { normalizeHexColor } from './color.js'
import { asArray, isObject } from './validation.js'

export const TEAM_BORDER_FALLBACK = '5B5B60'

export function teamBorderColors(team) {
  const primary = normalizeHexColor(team && team.color) || TEAM_BORDER_FALLBACK
  const alternate =
    normalizeHexColor(team && team.alternateColor) || primary
  return { primary, alternate }
}

export function normalizeSelectedTeam(team) {
  if (!isObject(team) || !String(team.id || '')) {
    return null
  }
  const displayName = String(team.displayName || team.name || '').trim()
  if (!displayName) {
    return null
  }
  const colors = teamBorderColors(team)
  return {
    ...team,
    id: String(team.id),
    name: String(team.name || displayName),
    displayName,
    shortName: String(
      team.shortName || team.shortDisplayName || displayName,
    ),
    leagueCode: String(team.leagueCode || ''),
    color: colors.primary,
    alternateColor: colors.alternate,
  }
}

export function restoreSelectedTeam(teams, storedTeam, leagueCode) {
  const stored = normalizeSelectedTeam(storedTeam)
  const normalizedLeagueCode = String(leagueCode || '')
  if (!stored || stored.leagueCode !== normalizedLeagueCode) {
    return null
  }
  const team = asArray(teams).find(
    (entry) => String(entry && entry.id) === stored.id,
  )
  return normalizeSelectedTeam(team)
}

export function selectLeagueTeamCache(cachesByLeague, leagueCode) {
  if (!isObject(cachesByLeague)) {
    return null
  }
  const normalizedLeagueCode = String(leagueCode || '')
  const cache = cachesByLeague[normalizedLeagueCode]
  if (
    !isObject(cache) ||
    String(cache.leagueCode || '') !== normalizedLeagueCode ||
    !Array.isArray(cache.teams)
  ) {
    return null
  }
  return cache
}
