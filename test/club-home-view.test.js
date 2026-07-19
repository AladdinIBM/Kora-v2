import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLUB_HOME_LAYOUT,
  deriveScheduledClubHomeView,
} from '../shared/club-home-view.js'
import { makeFixture } from './helpers.js'

const NOW = Date.parse('2026-07-19T12:00:00Z')

test('locks the supplied 390 by 450 club-home geometry', () => {
  assert.deepEqual(CLUB_HOME_LAYOUT.screen, {
    width: 390,
    height: 450,
  })
  assert.deepEqual(
    {
      x: CLUB_HOME_LAYOUT.display.x,
      y: CLUB_HOME_LAYOUT.display.y,
      width: CLUB_HOME_LAYOUT.display.width,
      height: CLUB_HOME_LAYOUT.display.height,
    },
    { x: 19, y: 45, width: 351, height: 372 },
  )
  assert.equal(
    CLUB_HOME_LAYOUT.scroll.y + CLUB_HOME_LAYOUT.upcoming.y,
    425,
  )
})

test('keeps the compact header inside the rounded-screen safe area', () => {
  const header = CLUB_HOME_LAYOUT.header
  assert.deepEqual(
    {
      x: header.x,
      right: header.x + header.width,
      actionSize: header.actionSize,
      actionIconSize: header.actionIconSize,
      clubLogoSize: header.clubLogoSize,
    },
    {
      x: 24,
      right: 362,
      actionSize: 38,
      actionIconSize: 22,
      clubLogoSize: 30,
    },
  )
})

test('returns four sorted, unique, future scheduled upcoming fixtures', () => {
  const primary = makeFixture(
    'primary',
    '2026-07-20T18:00:00Z',
  )
  const cache = {
    primaryFixture: primary,
    upcomingFixtures: [
      makeFixture('fifth', '2026-07-25T18:00:00Z'),
      makeFixture('third', '2026-07-23T18:00:00Z'),
      makeFixture('primary', '2026-07-20T18:00:00Z'),
      makeFixture('past', '2026-07-18T18:00:00Z'),
      makeFixture('second', '2026-07-22T18:00:00Z'),
      makeFixture('finished', '2026-07-21T18:00:00Z', 'finished'),
      makeFixture('fourth', '2026-07-24T18:00:00Z'),
      makeFixture('first', '2026-07-21T18:00:00Z'),
    ],
  }

  const view = deriveScheduledClubHomeView(cache, NOW)

  assert.equal(view.kind, 'scheduled')
  assert.equal(view.primaryFixture, primary)
  assert.deepEqual(
    view.upcomingFixtures.map((fixture) => fixture.id),
    ['first', 'second', 'third', 'fourth'],
  )
})

test('rejects a scheduled primary fixture that is no longer in the future', () => {
  const view = deriveScheduledClubHomeView(
    {
      primaryFixture: makeFixture(
        'expired',
        '2026-07-19T11:59:00Z',
      ),
      upcomingFixtures: [],
    },
    NOW,
  )

  assert.equal(view, null)
})
