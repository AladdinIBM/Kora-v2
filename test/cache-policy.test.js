import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fixtureRefreshReason,
  isCacheFresh,
  rollFixtureCacheForward,
  shouldRefreshFixtureCache,
} from '../shared/cache-policy.js'
import { RequestCoordinator } from '../shared/request-coordinator.js'
import { makeFixture } from './helpers.js'

const now = Date.parse('2026-07-17T12:00:00Z')

function cache(ageMs, primaryFixture = makeFixture('next', '2026-07-19T12:00:00Z')) {
  return {
    fetchedAt: now - ageMs,
    primaryFixture,
    upcomingFixtures: [],
  }
}

test('cache under six hours is fresh and cache over six hours is stale', () => {
  assert.equal(isCacheFresh(cache(5 * 60 * 60 * 1000), now), true)
  assert.equal(isCacheFresh(cache(7 * 60 * 60 * 1000), now), false)
})

test('near-kickoff, live, and manual refresh override TTL', () => {
  assert.equal(
    fixtureRefreshReason(
      cache(
        1000,
        makeFixture('near', '2026-07-17T14:00:00Z', 'scheduled'),
      ),
      { nowMs: now },
    ),
    'near-kickoff',
  )
  assert.equal(
    fixtureRefreshReason(
      cache(1000, makeFixture('live', '2026-07-17T11:00:00Z', 'live')),
      { nowMs: now },
    ),
    'live',
  )
  assert.equal(
    shouldRefreshFixtureCache(cache(1000), { nowMs: now, manual: true }),
    true,
  )
})

test('deduplicates concurrent in-flight requests', async () => {
  const coordinator = new RequestCoordinator({ timeoutMs: 100 })
  let calls = 0
  const task = () => {
    calls += 1
    return Promise.resolve('ok')
  }
  const first = coordinator.run('team:83', task)
  const second = coordinator.run('team:83', task)

  assert.equal(first, second)
  assert.equal(await first, 'ok')
  assert.equal(calls, 1)
})

test('invokes host timer functions with the global receiver', async () => {
  let timerId = 0
  const activeTimers = new Map()
  const coordinator = new RequestCoordinator({
    timeoutMs: 100,
    setTimer(callback) {
      assert.equal(this, globalThis)
      timerId += 1
      activeTimers.set(timerId, callback)
      return timerId
    },
    clearTimer(id) {
      assert.equal(this, globalThis)
      activeTimers.delete(id)
    },
  })

  assert.equal(await coordinator.run('team:83', () => 'ok'), 'ok')
  assert.equal(activeTimers.size, 0)
})

test('logical timeout rejects and ignores a late result', async () => {
  const coordinator = new RequestCoordinator({ timeoutMs: 5 })
  let lateResolution = false
  const late = coordinator.run(
    'team:83',
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          lateResolution = true
          resolve('too late')
        }, 20)
      }),
  )

  await assert.rejects(late, (error) => error.code === 'TIMEOUT')
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(lateResolution, true)
  assert.equal(coordinator.has('team:83'), false)
})

test('fresh successful empty cache does not refresh repeatedly', () => {
  assert.equal(
    fixtureRefreshReason(
      {
        fetchedAt: now - 1_000,
        primaryFixture: null,
        upcomingFixtures: [],
      },
      { nowMs: now },
    ),
    null,
  )
})

test('finished cache rolls to its next fixture after local midnight', () => {
  const finished = makeFixture(
    'finished',
    '2026-07-17T19:00:00Z',
    'finished',
  )
  const next = makeFixture(
    'next',
    '2026-07-19T19:00:00Z',
    'scheduled',
  )
  const getUtcDateKey = (timestamp) =>
    new Date(timestamp).toISOString().slice(0, 10)
  const rolled = rollFixtureCacheForward(
    {
      teamId: '83',
      fetchedAt: Date.parse('2026-07-17T21:00:00Z'),
      primaryFixture: finished,
      upcomingFixtures: [next],
    },
    Date.parse('2026-07-18T01:00:00Z'),
    getUtcDateKey,
  )

  assert.equal(rolled.primaryFixture.id, 'next')
  assert.deepEqual(rolled.upcomingFixtures, [])
  assert.equal(
    fixtureRefreshReason(
      {
        fetchedAt: Date.parse('2026-07-17T21:00:00Z'),
        primaryFixture: finished,
        upcomingFixtures: [next],
      },
      {
        nowMs: Date.parse('2026-07-18T01:00:00Z'),
        getDateKey: getUtcDateKey,
      },
    ),
    'day-rollover',
  )
})
