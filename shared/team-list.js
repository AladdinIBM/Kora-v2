import { asArray, stableUniqueBy } from './validation.js'

export function reconcileTeamLists(bundledTeams, remoteTeams) {
  const bundledById = new Map(
    asArray(bundledTeams).map((team) => [String(team.id), team]),
  )

  const merged = asArray(remoteTeams).map((remote) => {
    const bundled = bundledById.get(String(remote.id))
    return {
      ...(bundled || {}),
      ...remote,
      id: String(remote.id),
      localLogoPath:
        (bundled && bundled.localLogoPath) || remote.localLogoPath || null,
    }
  })

  for (const bundled of asArray(bundledTeams)) {
    if (!merged.some((team) => team.id === String(bundled.id))) {
      merged.push({ ...bundled, id: String(bundled.id) })
    }
  }

  return stableUniqueBy(merged, (team) => team.id).sort((first, second) =>
    first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }),
  )
}

