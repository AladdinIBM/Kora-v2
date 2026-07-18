import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function loadFixture(name) {
  const fixturePath = path.join(process.cwd(), 'test', 'fixtures', name)
  return JSON.parse(await readFile(fixturePath, 'utf8'))
}

export function makeFixture(
  id,
  startTimeUtc,
  status = 'scheduled',
  overrides = {},
) {
  return {
    id,
    competitionCode: 'eng.1',
    competitionName: 'Premier League',
    competitionShortName: 'PL',
    startTimeUtc,
    status,
    statusLabel: status,
    minute: status === 'live' ? '55' : null,
    homeTeam: {
      id: 'selected',
      name: 'Selected',
      abbreviation: 'SEL',
      logoUrl: null,
      localLogoPath: null,
      score: null,
    },
    awayTeam: {
      id: `opponent-${id}`,
      name: `Opponent ${id}`,
      abbreviation: 'OPP',
      logoUrl: null,
      localLogoPath: null,
      score: null,
    },
    ...overrides,
  }
}
