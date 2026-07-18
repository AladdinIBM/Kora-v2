import {
  DEVICE_REQUEST_TIMEOUT_MS,
  ERROR_CODES,
} from '../shared/constants.js'
import { ClubPulseError } from '../shared/errors.js'
import { RequestCoordinator } from '../shared/request-coordinator.js'

const coordinator = new RequestCoordinator({
  timeoutMs: DEVICE_REQUEST_TIMEOUT_MS,
})

function normalizeDeviceError(error) {
  if (error && Object.values(ERROR_CODES).includes(error.code)) {
    return error instanceof Error
      ? error
      : new ClubPulseError(error.code, error.message || error.code)
  }

  const message = String(
    (error && (error.message || error.reason)) || 'Network request failed',
  )
  const normalized = message.toLowerCase()
  if (
    (error && (error.code === 2 || error.code === 3)) ||
    normalized.includes('ble disconnect') ||
    normalized.includes('side service is not running')
  ) {
    return new ClubPulseError(ERROR_CODES.PHONE_DISCONNECTED, message)
  }
  if (normalized.includes('timeout')) {
    return new ClubPulseError(ERROR_CODES.TIMEOUT, message)
  }
  return new ClubPulseError(ERROR_CODES.NETWORK_ERROR, message)
}

export function requestSide(page, method, params, requestKey = method) {
  return coordinator
    .run(requestKey, () => page.request({ method, params }))
    .catch((error) => {
      throw normalizeDeviceError(error)
    })
}

export function isRequestInFlight(key) {
  return coordinator.has(key)
}

export function cancelLogicalRequest(key) {
  coordinator.invalidate(key)
}

export function clearLogicalRequests() {
  coordinator.clear()
}
