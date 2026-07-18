import { asArray } from './validation.js'

export function sortFixturesByStart(fixtures) {
  return [...asArray(fixtures)].sort(
    (first, second) =>
      Date.parse(first.startTimeUtc) - Date.parse(second.startTimeUtc),
  )
}

export function scheduledFixturesAfter(fixtures, timestampMs) {
  return sortFixturesByStart(fixtures).filter(
    (fixture) =>
      fixture.status === 'scheduled' &&
      Number.isFinite(Date.parse(fixture.startTimeUtc)) &&
      Date.parse(fixture.startTimeUtc) > timestampMs,
  )
}

export function opponentFor(fixture, selectedTeamId) {
  if (!fixture) {
    return null
  }
  const normalizedId = String(selectedTeamId)
  if (fixture.homeTeam && fixture.homeTeam.id === normalizedId) {
    return {
      opponent: fixture.awayTeam,
      venue: 'H',
    }
  }
  if (fixture.awayTeam && fixture.awayTeam.id === normalizedId) {
    return {
      opponent: fixture.homeTeam,
      venue: 'A',
    }
  }
  return null
}

