import { BaseSideService } from '@zeppos/zml/base-side'
import { LOGICAL_TIMEOUT_MS } from '../shared/constants.js'
import { RequestCoordinator } from '../shared/request-coordinator.js'
import { sideErrorPayload } from './error-mapper.js'
import {
  fetchLeagueTeams,
  fetchScheduleSelection,
  fetchTeam,
} from './espn-client.js'
import { ensureLogoTransfer } from './logo-service.js'

const coordinator = new RequestCoordinator({
  timeoutMs: LOGICAL_TIMEOUT_MS,
})

function requireId(value, label) {
  const id = String(value || '')
  if (!id) {
    throw {
      code: 'INVALID_RESPONSE',
      message: `${label} is required`,
    }
  }
  return id
}

async function handleRequest(sideService, request) {
  const params = request.params || {}
  switch (request.method) {
    case 'clubs.get': {
      const leagueCode = requireId(params.leagueCode, 'leagueCode')
      const teams = await coordinator.run(`clubs:${leagueCode}`, () =>
        fetchLeagueTeams(sideService, leagueCode),
      )
      return {
        leagueCode,
        fetchedAt: Date.now(),
        teams,
      }
    }
    case 'club.get': {
      const teamId = requireId(params.teamId, 'teamId')
      const team = await coordinator.run(`club:${teamId}`, () =>
        fetchTeam(sideService, teamId, params.leagueCode),
      )
      return {
        fetchedAt: Date.now(),
        team,
      }
    }
    case 'schedule.get': {
      const teamId = requireId(params.teamId, 'teamId')
      const selection = await coordinator.run(`schedule:${teamId}`, () =>
        fetchScheduleSelection(sideService, {
          teamId,
          nowMs: params.nowMs,
          timezoneOffsetMinutes: params.timezoneOffsetMinutes,
        }),
      )
      return {
        ...selection,
        fetchedAt: Date.now(),
      }
    }
    case 'logo.ensure': {
      const teamId = requireId(params.teamId, 'teamId')
      return coordinator.run(`logo:${teamId}`, () =>
        ensureLogoTransfer(sideService, {
          teamId,
          logoUrl: params.logoUrl,
        }),
      )
    }
    default:
      throw {
        code: 'INVALID_RESPONSE',
        message: `Unknown request method: ${request.method}`,
      }
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      this.log('ClubPulse Side Service initialized')
    },

    onRun() {
      this.log('ClubPulse Side Service running')
    },

    onRequest(request, respond) {
      this.debug(`request ${request.method}`)
      handleRequest(this, request).then(
        (result) => respond(null, result),
        (error) => {
          const payload = sideErrorPayload(error)
          this.error(`${request.method} failed: ${payload.code}`)
          respond(payload)
        },
      )
    },

    onDestroy() {
      coordinator.clear()
      this.log('ClubPulse Side Service destroyed')
    },
  }),
)

