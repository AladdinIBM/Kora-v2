import {
  getLogoCatalogDownloadStatus,
  runSeasonalLogoCatalogJob,
} from './logo-catalog-downloader.js'
import {
  readLogoCatalogState,
  writeLogoCatalogState,
} from './logo-catalog-service.js'

const TRANSFER_TIMEOUT_MS = 90 * 1000
let activeTransfer = null

function transferManifest(state) {
  const manifest = state.manifest
  const stagedAssets = state.stagedAssets || {}
  if (!manifest || !Array.isArray(manifest.teams)) return null
  const assets = []
  for (const team of manifest.teams) {
    const asset = stagedAssets[String(team.id)]
    if (!asset || !asset.filePath || !asset.revision || !asset.byteLength) {
      return null
    }
    assets.push({
      teamId: String(team.id),
      revision: String(asset.revision),
      byteLength: Number(asset.byteLength),
    })
  }
  return {
    season: manifest.season,
    totalTeams: assets.length,
    assets,
  }
}

function sendFileAndWait(sideService, filePath, params) {
  return new Promise((resolve, reject) => {
    let settled = false
    const transfer = sideService.sendFile(filePath, params)
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      if (typeof transfer.cancel === 'function') transfer.cancel()
      reject(new Error(`Logo transfer timed out for ${params.teamId}`))
    }, TRANSFER_TIMEOUT_MS)

    const finish = (error = null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve()
    }

    if (transfer.readyState === 'transferred') {
      finish()
      return
    }
    transfer.on('change', (event) => {
      const readyState = event && event.data && event.data.readyState
      if (readyState === 'transferred') finish()
      else if (readyState === 'error' || readyState === 'canceled') {
        finish(new Error(`Logo transfer ${readyState} for ${params.teamId}`))
      }
    })
  })
}

export async function transferLogoCatalogFiles(
  sideService,
  manifest,
  receivedAssets,
) {
  const received = new Map(
    (Array.isArray(receivedAssets) ? receivedAssets : []).map((asset) => [
      String(asset.teamId),
      String(asset.revision),
    ]),
  )
  const state = readLogoCatalogState(sideService.settings)
  const pending = manifest.assets.filter(
    (asset) => received.get(asset.teamId) !== asset.revision,
  )
  const transferredTeamIds = []

  writeLogoCatalogState(sideService.settings, {
    ...state,
    status: pending.length ? 'transferring' : 'transfer_sent',
    transferSeason: manifest.season,
    transferTotal: manifest.totalTeams,
    transferCompleted: manifest.totalTeams - pending.length,
    lastError: null,
  })

  try {
    for (const asset of pending) {
      const staged = state.stagedAssets[asset.teamId]
      await sendFileAndWait(sideService, staged.filePath, {
        type: 'clubpulse-logo-catalog',
        season: manifest.season,
        teamId: asset.teamId,
        revision: asset.revision,
        byteLength: String(asset.byteLength),
        totalTeams: String(manifest.totalTeams),
      })
      transferredTeamIds.push(asset.teamId)
      writeLogoCatalogState(sideService.settings, {
        ...readLogoCatalogState(sideService.settings),
        status: 'transferring',
        transferCompleted:
          manifest.totalTeams - pending.length + transferredTeamIds.length,
      })
    }

    writeLogoCatalogState(sideService.settings, {
      ...readLogoCatalogState(sideService.settings),
      status: 'transfer_sent',
      transferCompleted: manifest.totalTeams,
      transferSentAt: Date.now(),
      lastError: null,
    })
    return { status: 'transfer_sent', transferredTeamIds }
  } catch (error) {
    writeLogoCatalogState(sideService.settings, {
      ...readLogoCatalogState(sideService.settings),
      status: 'transfer_failed',
      lastError: String(error.message || error),
    })
    throw error
  }
}

function startTransfer(sideService, manifest, receivedAssets) {
  if (activeTransfer) return activeTransfer
  activeTransfer = transferLogoCatalogFiles(
    sideService,
    manifest,
    receivedAssets,
  )
    .finally(() => {
      activeTransfer = null
    })
  return activeTransfer
}

export function queueLogoCatalogTransfer(
  sideService,
  { watchSeason = null, receivedAssets = [] } = {},
) {
  const state = readLogoCatalogState(sideService.settings)
  const manifest = transferManifest(state)
  if (!manifest) {
    runSeasonalLogoCatalogJob(sideService)
      .then(() => {
        const readyManifest = transferManifest(
          readLogoCatalogState(sideService.settings),
        )
        if (readyManifest) {
          const resumeAssets = watchSeason === readyManifest.season
            ? receivedAssets
            : []
          startTransfer(sideService, readyManifest, resumeAssets).catch(
            (error) => sideService.error(`Logo catalog transfer failed: ${error.message}`),
          )
        }
      })
      .catch((error) => {
        sideService.error(`Logo catalog staging failed: ${error.message}`)
      })
    return {
      queued: true,
      ...getLogoCatalogDownloadStatus(sideService.settings),
      manifest: null,
    }
  }

  const resumeAssets = watchSeason === manifest.season ? receivedAssets : []
  setTimeout(() => {
    startTransfer(sideService, manifest, resumeAssets).catch((error) => {
      sideService.error(`Logo catalog transfer failed: ${error.message}`)
    })
  }, 0)
  return {
    queued: true,
    status: 'transfer_queued',
    season: manifest.season,
    totalTeams: manifest.totalTeams,
    manifest,
  }
}
