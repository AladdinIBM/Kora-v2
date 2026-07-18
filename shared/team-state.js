import { normalizeFollowedTeams } from './storage-migrations.js'

export function addFollowedTeam(followedTeams, team) {
  const current = normalizeFollowedTeams(followedTeams)
  if (!team || current.some((entry) => entry.id === String(team.id))) {
    return current
  }
  return [...current, { ...team, id: String(team.id) }]
}

export function removeFollowedTeam(
  followedTeams,
  removedTeamId,
  lastViewedTeamId,
) {
  const removedId = String(removedTeamId)
  const remainingTeams = normalizeFollowedTeams(followedTeams).filter(
    (team) => team.id !== removedId,
  )
  const currentStillExists = remainingTeams.some(
    (team) => team.id === String(lastViewedTeamId),
  )

  return {
    followedTeams: remainingTeams,
    lastViewedTeamId: currentStillExists
      ? String(lastViewedTeamId)
      : remainingTeams[0]?.id || null,
    onboardingRequired: remainingTeams.length === 0,
  }
}

export function resolveLaunchTeam(followedTeams, lastViewedTeamId) {
  const teams = normalizeFollowedTeams(followedTeams)
  if (teams.length === 0) {
    return {
      teamId: null,
      repairedLastViewedTeamId: null,
      onboardingRequired: true,
    }
  }
  const requested = String(lastViewedTeamId || '')
  const resolved = teams.find((team) => team.id === requested) || teams[0]
  return {
    teamId: resolved.id,
    repairedLastViewedTeamId:
      resolved.id === requested ? null : resolved.id,
    onboardingRequired: false,
  }
}

export function orderMyTeams(followedTeams, currentTeamId) {
  const currentId = String(currentTeamId || '')
  return [...normalizeFollowedTeams(followedTeams)].sort((first, second) => {
    if (first.id === currentId) return -1
    if (second.id === currentId) return 1
    return first.name.localeCompare(second.name, 'en', {
      sensitivity: 'base',
    })
  })
}

