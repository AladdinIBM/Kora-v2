import assert from 'node:assert/strict'
import test from 'node:test'
import {
  localDateKeyAtOffset,
  selectPrimaryFixture,
  selectSchedulePayload,
  selectUpcomingFixtures,
} from '../shared/match-selector.js'
import { makeFixture } from './helpers.js'

const now = Date.parse('2026-07-17T20:00:00Z')
const utcKey = (value) => localDateKeyAtOffset(value, 0)

test('live outranks finished today and upcoming', () => {
  const fixtures = [
    makeFixture('upcoming', '2026-07-18T12:00:00Z'),
    makeFixture('finished', '2026-07-17T13:00:00Z', 'finished'),
    makeFixture('live', '2026-07-17T19:00:00Z', 'live'),
  ]
  assert.equal(selectPrimaryFixture(fixtures, now, utcKey).id, 'live')
})

test('most recently finished match remains primary before local midnight', () => {
  const fixtures = [
    makeFixture('early', '2026-07-17T12:00:00Z', 'finished'),
    makeFixture('late', '2026-07-17T16:00:00Z', 'finished'),
    makeFixture('next', '2026-07-18T12:00:00Z'),
  ]
  assert.equal(selectPrimaryFixture(fixtures, now, utcKey).id, 'late')
})

test('upcoming becomes primary after local midnight', () => {
  const fixtures = [
    makeFixture('finished', '2026-07-17T20:00:00Z', 'finished'),
    makeFixture('next', '2026-07-18T12:00:00Z'),
  ]
  const afterMidnight = Date.parse('2026-07-18T00:01:00Z')
  assert.equal(selectPrimaryFixture(fixtures, afterMidnight, utcKey).id, 'next')
})

test('local day selection follows the device timezone at a day boundary', () => {
  const finished = makeFixture(
    'finished',
    '2026-07-17T23:30:00Z',
    'finished',
  )
  const upcoming = makeFixture('next', '2026-07-18T09:00:00Z')
  const nowUtc = Date.parse('2026-07-18T00:30:00Z')

  assert.equal(
    selectPrimaryFixture(
      [finished, upcoming],
      nowUtc,
      (value) => localDateKeyAtOffset(value, 120),
    ).id,
    'finished',
  )
  assert.equal(
    selectPrimaryFixture(
      [finished, upcoming],
      nowUtc,
      (value) => localDateKeyAtOffset(value, -180),
    ).id,
    'finished',
  )

  const later = Date.parse('2026-07-18T04:00:00Z')
  assert.equal(
    selectPrimaryFixture(
      [finished, upcoming],
      later,
      (value) => localDateKeyAtOffset(value, -180),
    ).id,
    'next',
  )
})

test('preserves home and away teams in the primary fixture', () => {
  const fixture = makeFixture('away-selected', '2026-07-18T12:00:00Z', 'scheduled', {
    homeTeam: { id: 'opponent', name: 'Opponent' },
    awayTeam: { id: 'selected', name: 'Selected' },
  })
  const primary = selectPrimaryFixture([fixture], now, utcKey)
  assert.equal(primary.homeTeam.id, 'opponent')
  assert.equal(primary.awayTeam.id, 'selected')
})

test('scheduled primary is excluded from up to four additional fixtures', () => {
  const fixtures = Array.from({ length: 7 }, (_, index) =>
    makeFixture(
      `match-${index}`,
      `2026-07-${String(18 + index).padStart(2, '0')}T12:00:00Z`,
    ),
  )
  const payload = selectSchedulePayload('selected', fixtures, now, utcKey)
  assert.equal(payload.primaryFixture.id, 'match-0')
  assert.deepEqual(
    payload.upcomingFixtures.map((fixture) => fixture.id),
    ['match-1', 'match-2', 'match-3', 'match-4'],
  )
})

test('finished or live primary yields the next four scheduled fixtures', () => {
  const live = makeFixture('live', '2026-07-17T19:00:00Z', 'live')
  const future = Array.from({ length: 6 }, (_, index) =>
    makeFixture(
      `future-${index}`,
      `2026-07-${String(18 + index).padStart(2, '0')}T12:00:00Z`,
    ),
  )
  const upcoming = selectUpcomingFixtures([live, ...future], live, now)
  assert.equal(upcoming.length, 4)
  assert.equal(upcoming[0].id, 'future-0')
})

test('returns fewer than four fixtures when fewer exist', () => {
  const primary = makeFixture('primary', '2026-07-18T12:00:00Z')
  const second = makeFixture('second', '2026-07-19T12:00:00Z')
  assert.deepEqual(
    selectUpcomingFixtures([primary, second], primary, now).map(
      (fixture) => fixture.id,
    ),
    ['second'],
  )
})
