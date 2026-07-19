import { MAX_UPCOMING_FIXTURES } from './constants.js'
import { sortFixturesByStart } from './fixture-utils.js'
import { asArray } from './validation.js'

export const CLUB_HOME_UPCOMING_LIMIT = MAX_UPCOMING_FIXTURES

export const CLUB_HOME_LAYOUT = Object.freeze({
  screen: Object.freeze({
    width: 390,
    height: 450,
  }),
  header: Object.freeze({
    x: 24,
    y: 4,
    width: 338,
    height: 41,
    clubWidth: 258,
    actionSize: 38,
    actionIconSize: 22,
    clubLogoSize: 30,
    gap: 2,
  }),
  scroll: Object.freeze({
    x: 19,
    y: 45,
    width: 351,
    height: 405,
  }),
  display: Object.freeze({
    x: 19,
    y: 45,
    width: 351,
    height: 372,
    radius: 18,
    borderWidth: 1,
    accentHeight: 4,
  }),
  upcoming: Object.freeze({
    y: 380,
    headingHeight: 20,
    headingGap: 5,
    firstRowY: 405,
    rowHeight: 29,
    rowGap: 4,
  }),
})

function validFutureScheduledFixture(fixture, nowMs) {
  const kickoffMs = Date.parse(fixture && fixture.startTimeUtc)
  return (
    fixture?.status === 'scheduled' &&
    Number.isFinite(kickoffMs) &&
    kickoffMs > nowMs
  )
}

export function deriveScheduledClubHomeView(cache, nowMs = Date.now()) {
  const primaryFixture = cache?.primaryFixture
  if (!validFutureScheduledFixture(primaryFixture, nowMs)) {
    return null
  }

  const seen = new Set([String(primaryFixture.id)])
  const upcomingFixtures = sortFixturesByStart(
    asArray(cache?.upcomingFixtures).filter((fixture) =>
      validFutureScheduledFixture(fixture, nowMs),
    ),
  )
    .filter((fixture) => {
      const fixtureId = String(fixture.id)
      if (seen.has(fixtureId)) {
        return false
      }
      seen.add(fixtureId)
      return true
    })
    .slice(0, CLUB_HOME_UPCOMING_LIMIT)

  return Object.freeze({
    kind: 'scheduled',
    primaryFixture,
    upcomingFixtures,
  })
}
