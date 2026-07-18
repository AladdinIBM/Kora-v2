import { ERROR_CODES } from '../shared/constants.js'
import { ClubPulseError } from '../shared/errors.js'

export function mapSideError(error) {
  if (error && Object.values(ERROR_CODES).includes(error.code)) {
    return error
  }
  const message = String(
    (error && (error.message || error.reason)) || 'Network request failed',
  )
  const normalized = message.toLowerCase()
  if (normalized.includes('timeout')) {
    return new ClubPulseError(ERROR_CODES.TIMEOUT, message)
  }
  return new ClubPulseError(ERROR_CODES.NETWORK_ERROR, message)
}

export function sideErrorPayload(error) {
  const mapped = mapSideError(error)
  return {
    code: mapped.code,
    message: mapped.message,
  }
}
