import { BaseSideService } from '@zeppos/zml/base-side'
import { LOGICAL_TIMEOUT_MS } from '../shared/constants.js'
import { RequestCoordinator } from '../shared/request-coordinator.js'
import { sideErrorPayload } from './error-mapper.js'
import {
  fetchLeagueTeams,
  fetchScheduleSelection,
  fetchTeam,
} from './espn-client.js'
import {
  markLogoCatalogActivated,
  planSeasonalLogoCatalog,
} from './logo-catalog-service.js'
import {
  getLogoCatalogDownloadStatus,
  runSeasonalLogoCatalogJob,
} from './logo-catalog-downloader.js'
import { queueLogoCatalogTransfer } from './logo-catalog-transfer.js'

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
      return {
        teamId,
        queued: false,
        managedBy: 'seasonal-catalog',
      }
    }
    case 'logo.catalog.plan': {
      const nowMs = Number(params.nowMs)
      return coordinator.run('logo-catalog:plan', () =>
        planSeasonalLogoCatalog(sideService, {
          nowMs: Number.isFinite(nowMs) ? nowMs : Date.now(),
          watchSeason:
            params.watchSeason === undefined
              ? undefined
              : params.watchSeason,
          firstInstall: params.firstInstall === true,
          force: params.force === true,
        }),
      )
    }
    case 'logo.catalog.status':
      return getLogoCatalogDownloadStatus(sideService.settings)
    case 'logo.catalog.stage': {
      runSeasonalLogoCatalogJob(sideService, {
        nowMs: Number.isFinite(Number(params.nowMs))
          ? Number(params.nowMs)
          : Date.now(),
        firstInstall: params.firstInstall === true,
        force: params.force === true,
      }).catch((error) => {
        sideService.error(`Logo catalog staging failed: ${error.message}`)
      })
      return {
        queued: true,
        ...getLogoCatalogDownloadStatus(sideService.settings),
      }
    }
    case 'logo.catalog.transfer':
      return queueLogoCatalogTransfer(sideService, {
        watchSeason: params.watchSeason || null,
        receivedAssets: Array.isArray(params.receivedAssets)
          ? params.receivedAssets
          : [],
      })
    case 'logo.catalog.activated':
      return markLogoCatalogActivated(sideService, {
        season: params.season,
        totalTeams: params.totalTeams,
      })
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
      const status = getLogoCatalogDownloadStatus(this.settings)
      runSeasonalLogoCatalogJob(this, {
        firstInstall: status.status === 'idle',
      })
        .then((result) => {
          this.log(
            `Logo catalog ${result.status}; season=${result.season} ` +
              `logos=${result.readyLogos}/${result.totalTeams}`,
          )
        })
        .catch((error) => {
          this.error(`Logo catalog job failed: ${error.message}`)
        })
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
