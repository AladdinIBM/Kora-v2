import { ERROR_CODES } from './constants.js'

export class ClubPulseError extends Error {
  constructor(code, message, details = null) {
    super(message || code)
    this.name = 'ClubPulseError'
    this.code = code
    this.details = details
  }
}

export class InvalidResponseError extends ClubPulseError {
  constructor(message, details = null) {
    super(ERROR_CODES.INVALID_RESPONSE, message, details)
    this.name = 'InvalidResponseError'
  }
}

export function toErrorPayload(error) {
  const code =
    error && Object.values(ERROR_CODES).includes(error.code)
      ? error.code
      : ERROR_CODES.NETWORK_ERROR

  return {
    code,
    message: error && error.message ? String(error.message) : code,
  }
}

