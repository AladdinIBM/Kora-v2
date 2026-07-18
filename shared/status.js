import { asString } from './validation.js'

const STATUS_ALIASES = Object.freeze({
  postponed: ['STATUS_POSTPONED', 'POSTPONED'],
  suspended: ['STATUS_SUSPENDED', 'SUSPENDED', 'STATUS_DELAYED', 'DELAYED'],
  cancelled: ['STATUS_CANCELED', 'STATUS_CANCELLED', 'CANCELED', 'CANCELLED'],
  halftime: ['STATUS_HALFTIME', 'STATUS_HALF_TIME', 'HALFTIME', 'HT'],
  finished: ['STATUS_FULL_TIME', 'STATUS_FINAL', 'FINAL', 'POST', 'FT'],
  scheduled: [
    'STATUS_SCHEDULED',
    'STATUS_NOT_STARTED',
    'SCHEDULED',
    'PRE',
  ],
  live: [
    'STATUS_IN_PROGRESS',
    'STATUS_FIRST_HALF',
    'STATUS_SECOND_HALF',
    'STATUS_EXTRA_TIME',
    'STATUS_PENALTY_SHOOTOUT',
    'IN_PROGRESS',
    'LIVE',
  ],
})

function canonicalToken(value) {
  return asString(value).toUpperCase().replace(/[\s-]+/g, '_')
}

export function mapEspnStatus(statusType = {}) {
  const candidates = [
    statusType.name,
    statusType.description,
    statusType.detail,
    statusType.shortDetail,
  ].map(canonicalToken)

  for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
    if (
      candidates.some((candidate) =>
        aliases.some(
          (alias) => candidate === alias || candidate.includes(alias),
        ),
      )
    ) {
      return status
    }
  }

  if (statusType.completed === true) {
    return 'finished'
  }
  const state = canonicalToken(statusType.state)
  if (state === 'IN') {
    return 'live'
  }
  if (state === 'POST') {
    return 'finished'
  }
  return 'scheduled'
}

export function defaultStatusLabel(status) {
  const labels = {
    scheduled: 'Scheduled',
    live: 'LIVE',
    halftime: 'HT',
    finished: 'FT',
    postponed: 'Postponed',
    suspended: 'Suspended',
    cancelled: 'Cancelled',
  }
  return labels[status] || labels.scheduled
}

export function isLiveStatus(status) {
  return status === 'live' || status === 'halftime'
}

export function isTerminalStatus(status) {
  return (
    status === 'finished' ||
    status === 'postponed' ||
    status === 'cancelled'
  )
}
