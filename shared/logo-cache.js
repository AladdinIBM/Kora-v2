import { MAX_DYNAMIC_LOGOS } from './constants.js'
import { asArray, isObject } from './validation.js'

export function normalizeLogoIndex(value) {
  if (!isObject(value)) {
    return {}
  }
  const result = {}
  for (const [teamId, entry] of Object.entries(value)) {
    if (
      isObject(entry) &&
      typeof entry.localPath === 'string' &&
      entry.localPath &&
      typeof entry.sourceUrl === 'string' &&
      entry.sourceUrl
    ) {
      result[teamId] = {
        localPath: entry.localPath,
        sourceUrl: entry.sourceUrl,
        lastUsedAt: Number(entry.lastUsedAt) || 0,
        bundled: entry.bundled === true,
      }
    }
  }
  return result
}

export function planLogoEvictions(
  logoIndex,
  protectedTeamIds,
  maxEntries = MAX_DYNAMIC_LOGOS,
) {
  const index = normalizeLogoIndex(logoIndex)
  const protectedIds = new Set(asArray(protectedTeamIds).map(String))
  const dynamicEntries = Object.entries(index).filter(
    ([, entry]) => entry.bundled !== true,
  )
  const excess = Math.max(0, dynamicEntries.length - maxEntries)

  return dynamicEntries
    .filter(([teamId]) => !protectedIds.has(teamId))
    .sort(([, first], [, second]) => first.lastUsedAt - second.lastUsedAt)
    .slice(0, excess)
    .map(([teamId, entry]) => ({
      teamId,
      localPath: entry.localPath,
    }))
}

