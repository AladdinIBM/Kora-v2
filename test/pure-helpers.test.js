import assert from 'node:assert/strict'
import test from 'node:test'
import {
  contrastRatio,
  hexToNumber,
  normalizeHexColor,
  readableAccent,
} from '../shared/color.js'
import { opponentFor, sortFixturesByStart } from '../shared/fixture-utils.js'
import { planLogoEvictions } from '../shared/logo-cache.js'
import { defaultStatusLabel, mapEspnStatus } from '../shared/status.js'
import { reconcileTeamLists } from '../shared/team-list.js'
import {
  asArray,
  firstNonEmpty,
  isValidIsoTimestamp,
  stableUniqueBy,
} from '../shared/validation.js'
import { makeFixture } from './helpers.js'

test('color helpers normalize, validate contrast, and choose a fallback', () => {
  assert.equal(normalizeHexColor('#a50044'), 'A50044')
  assert.equal(normalizeHexColor('xyz'), null)
  assert.equal(hexToNumber('FFFFFF'), 0xffffff)
  assert.ok(contrastRatio('FFFFFF', '000000') > 20)
  assert.equal(readableAccent('000001', null), '3B82F6')
})

test('status mapping handles ESPN states and labels', () => {
  assert.equal(mapEspnStatus({ name: 'STATUS_HALFTIME' }), 'halftime')
  assert.equal(mapEspnStatus({ state: 'post', completed: true }), 'finished')
  assert.equal(defaultStatusLabel('cancelled'), 'Cancelled')
})

test('fixture helpers sort and find the selected team opponent', () => {
  const later = makeFixture('later', '2026-07-19T12:00:00Z')
  const sooner = makeFixture('sooner', '2026-07-18T12:00:00Z')
  assert.deepEqual(sortFixturesByStart([later, sooner]).map((item) => item.id), [
    'sooner',
    'later',
  ])
  assert.equal(opponentFor(sooner, 'selected').opponent.id, 'opponent-sooner')
  assert.equal(opponentFor(sooner, 'selected').venue, 'H')
})

test('logo LRU never evicts protected or bundled logos', () => {
  const index = {
    bundled: {
      localPath: 'teams/bundled.png',
      sourceUrl: 'https://example/bundled.png',
      lastUsedAt: 1,
      bundled: true,
    },
    protected: {
      localPath: 'data://protected.png',
      sourceUrl: 'https://example/protected.png',
      lastUsedAt: 2,
    },
    oldest: {
      localPath: 'data://oldest.png',
      sourceUrl: 'https://example/oldest.png',
      lastUsedAt: 3,
    },
    newest: {
      localPath: 'data://newest.png',
      sourceUrl: 'https://example/newest.png',
      lastUsedAt: 4,
    },
  }
  assert.deepEqual(planLogoEvictions(index, ['protected'], 2), [
    { teamId: 'oldest', localPath: 'data://oldest.png' },
  ])
})

test('validation helpers remain defensive and stable', () => {
  assert.deepEqual(asArray(null), [])
  assert.equal(firstNonEmpty(null, '', 'value'), 'value')
  assert.equal(isValidIsoTimestamp('2026-07-17T12:00:00Z'), true)
  assert.deepEqual(
    stableUniqueBy([{ id: '1' }, { id: '1' }, { id: '2' }], (item) => item.id),
    [{ id: '1' }, { id: '2' }],
  )
})

test('team list reconciliation keeps local assets and appends new remote clubs', () => {
  const bundled = [
    { id: '1', name: 'Zulu', localLogoPath: 'teams/1.png' },
    { id: '2', name: 'Bravo', localLogoPath: 'teams/2.png' },
  ]
  const remote = [
    { id: '1', name: 'Alpha', logoUrl: 'https://example/1.png' },
    { id: '3', name: 'Charlie', logoUrl: 'https://example/3.png' },
  ]
  const reconciled = reconcileTeamLists(bundled, remote)
  assert.deepEqual(
    reconciled.map((team) => team.name),
    ['Alpha', 'Bravo', 'Charlie'],
  )
  assert.equal(reconciled[0].localLogoPath, 'teams/1.png')
})
