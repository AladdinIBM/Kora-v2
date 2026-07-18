import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeSelectedTeam,
  restoreSelectedTeam,
  selectLeagueTeamCache,
  teamBorderColors,
} from '../shared/team-selection.js'

test('team border colors normalize API hex and use safe fallbacks', () => {
  assert.deepEqual(
    teamBorderColors({ color: '#004d98', alternateColor: 'a50044' }),
    { primary: '004D98', alternate: 'A50044' },
  )
  assert.deepEqual(teamBorderColors({ color: 'invalid' }), {
    primary: '5B5B60',
    alternate: '5B5B60',
  })
  assert.deepEqual(teamBorderColors({ color: '00954c', alternateColor: null }), {
    primary: '00954C',
    alternate: '00954C',
  })
})

test('selected teams store normalized colors and display names', () => {
  const selected = normalizeSelectedTeam({
    id: 83,
    displayName: 'Barcelona',
    leagueCode: 'esp.1',
    color: '#004d98',
    alternateColor: 'a50044',
  })
  assert.equal(selected.id, '83')
  assert.equal(selected.name, 'Barcelona')
  assert.equal(selected.color, '004D98')
  assert.equal(selected.alternateColor, 'A50044')
})

test('league caches are selected only for their matching league', () => {
  const caches = {
    'eng.1': { leagueCode: 'eng.1', teams: [{ id: '359' }] },
    'esp.1': { leagueCode: 'esp.1', teams: [{ id: '83' }] },
  }
  assert.equal(selectLeagueTeamCache(caches, 'esp.1'), caches['esp.1'])
  assert.equal(selectLeagueTeamCache(caches, 'ger.1'), null)
})

test('stored selection restores only inside the current league and list', () => {
  const teams = [
    {
      id: '83',
      name: 'Barcelona',
      leagueCode: 'esp.1',
      color: '004D98',
      alternateColor: 'A50044',
    },
  ]
  const stored = normalizeSelectedTeam(teams[0])
  assert.equal(restoreSelectedTeam(teams, stored, 'esp.1').id, '83')
  assert.equal(restoreSelectedTeam(teams, stored, 'eng.1'), null)
  assert.equal(restoreSelectedTeam([], stored, 'esp.1'), null)
})
