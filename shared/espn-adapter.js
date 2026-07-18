import { InvalidResponseError } from './errors.js'
import { defaultStatusLabel, mapEspnStatus } from './status.js'
import {
  asArray,
  asNullableString,
  asString,
  firstNonEmpty,
  isObject,
  isValidIsoTimestamp,
  parseJsonBody,
  stableUniqueBy,
  toFiniteNumber,
} from './validation.js'

function selectLogo(logos) {
  const candidates = asArray(logos).filter(
    (logo) => isObject(logo) && asString(logo.href),
  )
  const defaultLogo = candidates.find((logo) =>
    asArray(logo.rel).includes('default'),
  )
  const href = asString((defaultLogo || candidates[0] || {}).href)
  if (!href) {
    return null
  }
  const espnCdnMatch = href.match(
    /^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/soccer\/500(?:-dark)?\/[^?]+)$/,
  )
  if (!espnCdnMatch) {
    return href
  }
  return (
    `https://a.espncdn.com/combiner/i?img=${espnCdnMatch[1]}` +
    '&w=100&h=100&scale=crop&cquality=40&location=origin'
  )
}

function normalizeScore(score) {
  if (isObject(score)) {
    const displayValue = asNullableString(score.displayValue)
    if (displayValue !== null) {
      return displayValue
    }
    const value = toFiniteNumber(score.value)
    return value === null ? null : String(value)
  }
  const normalized = asNullableString(score)
  return normalized
}

function normalizeMinute(status) {
  const displayClock = asString(status && status.displayClock)
  const clockMatch = displayClock.match(/(\d+(?:\+\d+)?)/)
  if (clockMatch) {
    return clockMatch[1]
  }
  const clock = toFiniteNumber(status && status.clock)
  return clock === null ? null : String(Math.max(0, Math.floor(clock)))
}

function normalizeCompetitor(competitor) {
  if (!isObject(competitor)) {
    return null
  }
  const team = isObject(competitor.team) ? competitor.team : {}
  const id = firstNonEmpty(team.id, competitor.id)
  if (!id) {
    return null
  }

  return {
    id,
    name: firstNonEmpty(
      team.displayName,
      team.shortDisplayName,
      team.location,
      team.name,
      'Unknown team',
    ),
    abbreviation: firstNonEmpty(team.abbreviation, '—'),
    logoUrl: selectLogo(team.logos),
    localLogoPath: null,
    score: normalizeScore(competitor.score),
  }
}

function findCompetition(event) {
  const competitions = asArray(event && event.competitions)
  return competitions.find(isObject) || null
}

function findHomeAndAway(competitors) {
  const valid = asArray(competitors)
    .map((raw) => ({
      raw,
      team: normalizeCompetitor(raw),
      side: asString(raw && raw.homeAway).toLowerCase(),
    }))
    .filter((entry) => entry.team)

  const home =
    valid.find((entry) => entry.side === 'home') ||
    valid.find((entry) => toFiniteNumber(entry.raw.order) === 0) ||
    valid[0]
  const away =
    valid.find((entry) => entry.side === 'away') ||
    valid.find((entry) => entry !== home) ||
    valid[1]

  if (!home || !away || home.team.id === away.team.id) {
    return null
  }
  return { homeTeam: home.team, awayTeam: away.team }
}

function normalizeCompetition(event, competition) {
  const league = isObject(event.league)
    ? event.league
    : isObject(competition.league)
      ? competition.league
      : {}
  const seasonType = isObject(event.seasonType) ? event.seasonType : {}

  const name = firstNonEmpty(
    league.name,
    seasonType.name,
    competition.type && competition.type.text,
    'Football',
  )

  return {
    competitionCode: firstNonEmpty(
      league.slug,
      league.midsizeName,
      league.abbreviation,
      league.id,
      seasonType.id,
      'football',
    ),
    competitionName: name,
    competitionShortName: firstNonEmpty(
      league.shortName,
      league.abbreviation,
      seasonType.abbreviation,
      name,
    ),
  }
}

function normalizeFixture(event) {
  if (!isObject(event)) {
    return null
  }
  const id = asString(event.id)
  const competition = findCompetition(event)
  if (!id || !competition) {
    return null
  }

  const startTime = firstNonEmpty(competition.date, event.date)
  if (!isValidIsoTimestamp(startTime)) {
    return null
  }

  const sides = findHomeAndAway(competition.competitors)
  if (!sides) {
    return null
  }

  const rawStatus = isObject(competition.status) ? competition.status : {}
  const statusType = isObject(rawStatus.type) ? rawStatus.type : rawStatus
  const status = mapEspnStatus(statusType)
  const competitionInfo = normalizeCompetition(event, competition)

  return {
    id,
    ...competitionInfo,
    startTimeUtc: new Date(startTime).toISOString(),
    status,
    statusLabel: defaultStatusLabel(status),
    minute: status === 'live' ? normalizeMinute(rawStatus) : null,
    homeTeam: sides.homeTeam,
    awayTeam: sides.awayTeam,
  }
}

function normalizeTeam(rawTeam, leagueCode) {
  if (!isObject(rawTeam)) {
    return null
  }
  const id = asString(rawTeam.id)
  const name = firstNonEmpty(
    rawTeam.displayName,
    rawTeam.name,
    rawTeam.shortDisplayName,
    rawTeam.location,
  )
  if (!id || !name) {
    return null
  }

  const shortDisplayName = firstNonEmpty(rawTeam.shortDisplayName, name)
  const logo = selectLogo(rawTeam.logos)
  return {
    id,
    uid: asNullableString(rawTeam.uid),
    slug: asNullableString(rawTeam.slug),
    name,
    displayName: name,
    shortName: shortDisplayName,
    shortDisplayName,
    abbreviation: firstNonEmpty(rawTeam.abbreviation, '—'),
    leagueCode: asString(leagueCode),
    color: asNullableString(rawTeam.color),
    alternateColor: asNullableString(rawTeam.alternateColor),
    logo,
    logoUrl: logo,
    localLogoPath: null,
  }
}

function findLeaguePayload(body, leagueCode) {
  for (const sport of asArray(body.sports)) {
    for (const league of asArray(sport && sport.leagues)) {
      if (!leagueCode || asString(league && league.slug) === leagueCode) {
        return league
      }
      if (asArray(league && league.teams).length > 0) {
        return league
      }
    }
  }
  return null
}

export class ESPNAdapter {
  static normalizeTeams(body, leagueCode) {
    const parsed = parseJsonBody(body, InvalidResponseError)
    const league = findLeaguePayload(parsed, leagueCode)
    if (!isObject(league) || !Array.isArray(league.teams)) {
      throw new InvalidResponseError('ESPN teams response has no teams array')
    }

    const teams = league.teams
      .map((entry) => normalizeTeam(entry && (entry.team || entry), leagueCode))
      .filter(Boolean)

    if (league.teams.length > 0 && teams.length === 0) {
      throw new InvalidResponseError(
        'ESPN teams response contains no valid team identifiers',
      )
    }

    return stableUniqueBy(teams, (team) => team.id).sort((first, second) =>
      first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }),
    )
  }

  static normalizeTeam(body, leagueCode = '') {
    const parsed = parseJsonBody(body, InvalidResponseError)
    const league = findLeaguePayload(parsed, leagueCode)
    const firstTeam = asArray(league && league.teams)[0]
    const rawTeam =
      (isObject(parsed.team) && parsed.team) ||
      (firstTeam && (firstTeam.team || firstTeam))
    const team = normalizeTeam(rawTeam, leagueCode)
    if (!team) {
      throw new InvalidResponseError(
        'ESPN team response contains no valid team identifier',
      )
    }
    return team
  }

  static normalizeSchedule(body) {
    const parsed = parseJsonBody(body, InvalidResponseError)
    if (!Array.isArray(parsed.events)) {
      throw new InvalidResponseError(
        'ESPN schedule response has no events array',
      )
    }

    return stableUniqueBy(
      parsed.events.map(normalizeFixture).filter(Boolean),
      (fixture) => fixture.id,
    ).sort(
      (first, second) =>
        Date.parse(first.startTimeUtc) - Date.parse(second.startTimeUtc),
    )
  }
}

export const ESPNAdapterInternals = Object.freeze({
  normalizeFixture,
  normalizeTeam,
  normalizeScore,
  selectLogo,
})
