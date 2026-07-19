import assert from 'node:assert/strict'
import test from 'node:test'
import { ESPNAdapter } from '../shared/espn-adapter.js'
import { InvalidResponseError } from '../shared/errors.js'
import { loadFixture } from './helpers.js'

test('normalizes and alphabetically sorts Premier League teams', async () => {
  const body = await loadFixture('teams-premier-league.json')
  const teams = ESPNAdapter.normalizeTeams(body, 'eng.1')

  assert.deepEqual(
    teams.map((team) => team.name),
    ['AFC Bournemouth', 'Arsenal'],
  )
  assert.equal(teams[1].logoUrl.includes('/soccer/500/359.png'), true)
  assert.equal(teams[1].logoUrl.includes('w=100&h=100'), true)
  assert.equal(teams[0].logoUrl, null)
  assert.equal(teams[0].logo, null)
  assert.equal(teams[0].displayName, 'AFC Bournemouth')
  assert.equal(teams[0].leagueCode, 'eng.1')
})

test('normalizes La Liga teams when body is a JSON string', async () => {
  const body = await loadFixture('teams-la-liga.json')
  const teams = ESPNAdapter.normalizeTeams(JSON.stringify(body), 'esp.1')

  assert.equal(teams.length, 2)
  assert.equal(teams[0].id, '83')
  assert.equal(teams[0].color, 'A50044')
  assert.match(teams[0].logoUrl, /\/500\/83\.png&w=100&h=100/)
})

test('normalizes every supported fixture status and preserves home/away', async () => {
  const body = await loadFixture('schedule-statuses.json')
  const fixtures = ESPNAdapter.normalizeSchedule(body)
  const byId = Object.fromEntries(fixtures.map((fixture) => [fixture.id, fixture]))

  for (const status of [
    'scheduled',
    'live',
    'halftime',
    'finished',
    'postponed',
    'suspended',
    'cancelled',
  ]) {
    assert.equal(byId[status].status, status)
  }
  assert.equal(byId.live.minute, '67')
  assert.equal(byId.live.homeTeam.score, '2')
  assert.equal(byId.live.awayTeam.score, '1')
  assert.equal(byId.halftime.homeTeam.id, '392')
  assert.equal(byId.halftime.awayTeam.id, '83')
  assert.equal(byId.finished.homeTeam.score, '3')
  assert.equal(byId.scheduled.venueName, 'Emirates Stadium')
})

test('defensively skips malformed events and defaults nullable fields', async () => {
  const body = await loadFixture('schedule-missing-fields.json')
  const fixtures = ESPNAdapter.normalizeSchedule(body)

  assert.equal(fixtures.length, 1)
  assert.equal(fixtures[0].id, 'defensive-valid')
  assert.equal(fixtures[0].competitionName, 'Football')
  assert.equal(fixtures[0].homeTeam.id, 'home')
  assert.equal(fixtures[0].awayTeam.id, 'away')
  assert.equal(fixtures[0].homeTeam.logoUrl, null)
  assert.equal(fixtures[0].homeTeam.score, null)
  assert.equal(fixtures[0].venueName, null)
})

test('throws a typed error for invalid JSON', () => {
  assert.throws(
    () => ESPNAdapter.normalizeSchedule('{not-json'),
    (error) =>
      error instanceof InvalidResponseError &&
      error.code === 'INVALID_RESPONSE',
  )
})

test('throws a typed error for unexpected schemas', () => {
  assert.throws(
    () => ESPNAdapter.normalizeTeams({ sports: [] }, 'eng.1'),
    InvalidResponseError,
  )
  assert.throws(
    () => ESPNAdapter.normalizeSchedule({ events: null }),
    InvalidResponseError,
  )
})

test('normalizes a club details response', () => {
  const team = ESPNAdapter.normalizeTeam(
    {
      team: {
        id: 83,
        displayName: 'Barcelona',
        abbreviation: 'BAR',
        color: null,
        logos: null,
      },
    },
    'esp.1',
  )

  assert.deepEqual(team, {
    id: '83',
    uid: null,
    slug: null,
    name: 'Barcelona',
    displayName: 'Barcelona',
    shortName: 'Barcelona',
    shortDisplayName: 'Barcelona',
    abbreviation: 'BAR',
    leagueCode: 'esp.1',
    color: null,
    alternateColor: null,
    logo: null,
    logoUrl: null,
    localLogoPath: null,
  })
})
