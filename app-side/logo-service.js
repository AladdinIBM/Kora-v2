import { ERROR_CODES, LOGICAL_TIMEOUT_MS } from '../shared/constants.js'
import { ClubPulseError } from '../shared/errors.js'

function safeTeamId(teamId) {
  const normalized = String(teamId || '')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(normalized)) {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      'Logo request contains an invalid team ID',
    )
  }
  return normalized
}

function safeLogoUrl(value) {
  try {
    const url = new URL(String(value))
    if (url.protocol !== 'https:') {
      throw new Error('Only HTTPS logo URLs are supported')
    }
    return url.toString()
  } catch {
    throw new ClubPulseError(
      ERROR_CODES.INVALID_RESPONSE,
      'Logo request contains an invalid HTTPS URL',
    )
  }
}

function downloadFile(sideService, url, filePath) {
  return new Promise((resolve, reject) => {
    const task = sideService.download(url, {
      timeout: LOGICAL_TIMEOUT_MS,
      headers: {
        Accept: 'image/png,image/*',
      },
      filePath,
    })
    task.onSuccess = (event) => {
      const status = Number(event.statusCode)
      if (status >= 200 && status < 300) {
        resolve(event.filePath || event.tempFilePath)
      } else {
        reject(
          new ClubPulseError(
            ERROR_CODES.HTTP_ERROR,
            `Logo download returned HTTP ${status}`,
          ),
        )
      }
    }
    task.onFail = (event) => {
      reject(
        new ClubPulseError(
          ERROR_CODES.NETWORK_ERROR,
          (event && event.message) || 'Logo download failed',
        ),
      )
    }
  })
}

export async function ensureLogoTransfer(
  sideService,
  { teamId, logoUrl },
) {
  const normalizedTeamId = safeTeamId(teamId)
  const normalizedUrl = safeLogoUrl(logoUrl)
  const sourcePath = `data://download/clubpulse-${normalizedTeamId}.png`
  const convertedPath =
    `data://download/clubpulse-${normalizedTeamId}-converted.png`
  const downloadedPath = await downloadFile(
    sideService,
    normalizedUrl,
    sourcePath,
  )
  const converted = await sideService.convert({
    filePath: downloadedPath,
    targetFilePath: convertedPath,
  })
  const transfer = sideService.sendFile(converted.targetFilePath, {
    type: 'clubpulse-logo',
    teamId: normalizedTeamId,
    sourceUrl: normalizedUrl,
  })
  transfer.on('change', (event) => {
    const state = event && event.data && event.data.readyState
    if (state === 'error') {
      console.log(`[ClubPulse] logo transfer failed for ${normalizedTeamId}`)
    }
  })
  return {
    teamId: normalizedTeamId,
    queued: true,
  }
}

