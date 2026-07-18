import assert from 'node:assert/strict'
import test from 'node:test'
import {
  migrateStorageSnapshot,
  safeParseJson,
  storageKeysForReset,
} from '../shared/storage-migrations.js'
import {
  addFollowedTeam,
  removeFollowedTeam,
  resolveLaunchTeam,
} from '../shared/team-state.js'

const arsenal = { id: '359', name: 'Arsenal' }
const barcelona = { id: '83', name: 'Barcelona' }

test('corrupted JSON recovers safely', () => {
  assert.deepEqual(safeParseJson('{bad', []), [])
  assert.deepEqual(safeParseJson(null, {}), {})
})

test('migrates legacy state to version 1 and repairs last viewed team', () => {
  const migrated = migrateStorageSnapshot({
    followedTeams: [arsenal, arsenal, barcelona],
    lastViewedTeamId: 'missing',
  })
  assert.equal(migrated.schemaVersion, 1)
  assert.deepEqual(
    migrated.followedTeams.map((team) => team.id),
    ['359', '83'],
  )
  assert.equal(migrated.lastViewedTeamId, '359')
})

test('duplicate followed teams cannot be added', () => {
  assert.equal(addFollowedTeam([arsenal], arsenal).length, 1)
  assert.equal(addFollowedTeam([arsenal], barcelona).length, 2)
})

test('removing the current team selects a valid remaining team', () => {
  const result = removeFollowedTeam([arsenal, barcelona], '359', '359')
  assert.equal(result.lastViewedTeamId, '83')
  assert.equal(result.onboardingRequired, false)
})

test('removing the final team returns to onboarding', () => {
  const result = removeFollowedTeam([arsenal], '359', '359')
  assert.deepEqual(result.followedTeams, [])
  assert.equal(result.lastViewedTeamId, null)
  assert.equal(result.onboardingRequired, true)
})

test('launch routing repairs invalid last viewed team', () => {
  const result = resolveLaunchTeam([arsenal, barcelona], 'missing')
  assert.equal(result.teamId, '359')
  assert.equal(result.repairedLastViewedTeamId, '359')
})

test('reset key plan deletes only ClubPulse-owned keys', () => {
  const keys = storageKeysForReset(['359', '83', '83'])
  assert.equal(keys.includes('clubpulse.selectedLeague'), true)
  assert.equal(keys.includes('clubpulse.selectedTeam'), true)
  assert.equal(keys.includes('clubPulse.fixtureCache.359'), true)
  assert.equal(keys.includes('clubPulse.fixtureCache.83'), true)
  assert.equal(keys.includes('unrelated.preference'), false)
  assert.equal(
    keys.filter((key) => key === 'clubPulse.fixtureCache.83').length,
    1,
  )
})
