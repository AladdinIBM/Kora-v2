import { BaseApp } from '@zeppos/zml/base-app'
import { clearTimeout, setTimeout } from '@zos/timer'
import { receiveCatalogLogo } from './device/logo-catalog-receiver.js'
import { receiveDynamicLogo } from './device/logo-receiver.js'
import { logoSyncPatchFromCatalogResult } from './shared/logo-sync-status.js'
import {
  activateReadyLogoCatalog,
  beginLogoCatalogTransfer,
  getLogoCatalogTransferState,
  getLogoSyncStatus,
  getReceivedCatalogAssets,
  registerDynamicLogo,
  setLogoSyncStatus,
  stageReceivedCatalogLogo,
} from './device/storage.js'

const TRANSFER_RETRY_MS = 30 * 1000

const globalData = {
  messaging: null,
  fileTransferLib: null,
}

function readableError(error) {
  if (typeof error === 'string' && error) return error
  if (error && typeof error.message === 'string' && error.message) {
    return error.message
  }
  if (error && error.data && typeof error.data.cause === 'string') {
    return error.data.cause
  }
  return 'Phone connection unavailable'
}

App(
  BaseApp({
    globalData,

    onCreate() {
      console.log('[ClubPulse] app created with ZML messaging')
      this.logoCatalogTimer = null
      this.logoCatalogAcknowledgedSeason = null
      if (!this.activateLogoCatalogIfReady()) {
        this.recordLogoTransferProgress(getLogoCatalogTransferState())
        this.requestLogoCatalogTransfer()
      }
    },

    recordLogoTransferProgress(state) {
      const transfer = state || getLogoCatalogTransferState()
      const total = Number(transfer.totalTeams) || 0
      setLogoSyncStatus({
        status: total > 0 ? 'transferring' : 'preparing',
        season: transfer.season || getLogoSyncStatus().season,
        completed: Object.keys(transfer.assets || {}).length,
        total,
        lastError: null,
      })
    },

    activateLogoCatalogIfReady() {
      const result = activateReadyLogoCatalog()
      if (result.transfer.status !== 'active' || !result.active.season) {
        return false
      }

      const totalTeams = Object.keys(result.active.assets).length
      setLogoSyncStatus({
        status: 'complete',
        season: result.active.season,
        completed: totalTeams,
        total: totalTeams,
        lastError: null,
      })
      console.log(
        `[ClubPulse] logo catalog active; ${totalTeams}/${totalTeams}`,
      )

      if (this.logoCatalogTimer !== null) {
        clearTimeout(this.logoCatalogTimer)
        this.logoCatalogTimer = null
      }
      if (this.logoCatalogAcknowledgedSeason === result.active.season) {
        return true
      }

      this.logoCatalogAcknowledgedSeason = result.active.season
      this.request({
        method: 'logo.catalog.activated',
        params: {
          season: result.active.season,
          totalTeams,
        },
      }).catch(() => {
        this.logoCatalogAcknowledgedSeason = null
        this.scheduleLogoCatalogRetry()
      })
      return true
    },

    requestLogoCatalogTransfer() {
      const state = getLogoCatalogTransferState()
      this.request({
        method: 'logo.catalog.transfer',
        params: {
          watchSeason: state.season,
          receivedAssets: getReceivedCatalogAssets(),
        },
      })
        .then((result) => {
          setLogoSyncStatus(logoSyncPatchFromCatalogResult(result))
          if (result && result.manifest) {
            this.recordLogoTransferProgress(
              beginLogoCatalogTransfer(result.manifest),
            )
          }
          if (!this.activateLogoCatalogIfReady()) {
            this.scheduleLogoCatalogRetry()
          }
        })
        .catch((error) => {
          setLogoSyncStatus({
            status: 'error',
            lastError: readableError(error),
          })
          this.scheduleLogoCatalogRetry()
        })
    },

    scheduleLogoCatalogRetry() {
      if (this.logoCatalogTimer !== null) {
        clearTimeout(this.logoCatalogTimer)
      }
      this.logoCatalogTimer = setTimeout(() => {
        this.logoCatalogTimer = null
        this.requestLogoCatalogTransfer()
      }, TRANSFER_RETRY_MS)
    },

    onReceivedFile(file) {
      if (
        receiveCatalogLogo(file, (payload) => {
          const result = stageReceivedCatalogLogo(payload)
          console.log(
            `[ClubPulse] catalog logo ${payload.teamId}; ` +
              `${Object.keys(result.state.assets).length}/${result.state.totalTeams}`,
          )
          this.recordLogoTransferProgress(result.state)
          if (result.complete) this.activateLogoCatalogIfReady()
        })
      ) {
        return
      }
      receiveDynamicLogo(file, ({ teamId, sourceUrl, localPath }) => {
        registerDynamicLogo(teamId, sourceUrl, localPath)
      })
    },

    onDestroy() {
      if (this.logoCatalogTimer !== null) {
        clearTimeout(this.logoCatalogTimer)
        this.logoCatalogTimer = null
      }
      console.log('[ClubPulse] app destroyed')
    },
  }),
)
