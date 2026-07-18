import { MAX_UPCOMING_FIXTURES } from './constants.js'
import { sortFixturesByStart } from './fixture-utils.js'
import { asArray } from './validation.js'

export function localDateKey(timestampMs) {
  const date = new Date(timestampMs)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localDateKeyAtOffset(timestampMs, offsetMinutes) {
  const shifted = new Date(timestampMs + offsetMinutes * 60 * 1000)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validFixtures(fixtures) {
  return sortFixturesByStart(fixtures).filter(
    (fixture) =>
      fixture &&
      fixture.id &&
      Number.isFinite(Date.parse(fixture.startTimeUtc)),
  )
}

function mostRecent(fixtures) {
  return fixtures.reduce((selected, fixture) => {
    if (!selected) {
      return fixture
    }
    return Date.parse(fixture.startTimeUtc) >
      Date.parse(selected.startTimeUtc)
      ? fixture
      : selected
  }, null)
}

export function selectPrimaryFixture(
  fixtures,
  nowMs = Date.now(),
  getDateKey = localDateKey,
) {
  const sorted = validFixtures(fixtures)
  const today = getDateKey(nowMs)

  const live = sorted.find(
    (fixture) => fixture.status === 'live' || fixture.status === 'halftime',
  )
  if (live) {
    return live
  }

  const finishedToday = sorted.filter(
    (fixture) =>
      fixture.status === 'finished' &&
      getDateKey(Date.parse(fixture.startTimeUtc)) === today,
  )
  if (finishedToday.length > 0) {
    return mostRecent(finishedToday)
  }

  const disruptedToday = sorted.filter(
    (fixture) =>
      ['postponed', 'suspended', 'cancelled'].includes(fixture.status) &&
      getDateKey(Date.parse(fixture.startTimeUtc)) === today,
  )
  if (disruptedToday.length > 0) {
    return mostRecent(disruptedToday)
  }

  return (
    sorted.find(
      (fixture) =>
        fixture.status === 'scheduled' &&
        Date.parse(fixture.startTimeUtc) > nowMs,
    ) || null
  )
}

export function selectUpcomingFixtures(
  fixtures,
  primaryFixture,
  nowMs = Date.now(),
  limit = MAX_UPCOMING_FIXTURES,
) {
  if (!primaryFixture) {
    return []
  }

  const threshold =
    primaryFixture.status === 'scheduled'
      ? Date.parse(primaryFixture.startTimeUtc)
      : nowMs

  return validFixtures(asArray(fixtures))
    .filter(
      (fixture) =>
        fixture.id !== primaryFixture.id &&
        fixture.status === 'scheduled' &&
        Date.parse(fixture.startTimeUtc) > threshold,
    )
    .slice(0, limit)
}

export function selectSchedulePayload(
  teamId,
  fixtures,
  nowMs = Date.now(),
  getDateKey = localDateKey,
) {
  const primaryFixture = selectPrimaryFixture(fixtures, nowMs, getDateKey)
  return {
    teamId: String(teamId),
    primaryFixture,
    upcomingFixtures: primaryFixture
      ? selectUpcomingFixtures(fixtures, primaryFixture, nowMs)
      : [],
  }
}

