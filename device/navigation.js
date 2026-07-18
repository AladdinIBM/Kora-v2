import { back, push, replace } from '@zos/router'

export const ROUTES = Object.freeze({
  index: 'page/index',
  leagues: 'page/league-select',
  teams: 'page/team-select',
  club: 'page/club-home',
  myTeams: 'page/my-teams',
  settings: 'page/settings',
  manageTeams: 'page/manage-teams',
})

export function replaceRoute(url, params) {
  replace({ url, params })
}

export function pushRoute(url, params) {
  push({ url, params })
}

export function openClub(teamId, useReplace = false) {
  const navigate = useReplace ? replaceRoute : pushRoute
  navigate(ROUTES.club, { teamId: String(teamId) })
}

export function goBack() {
  back()
}

export function parseRouteParams(params) {
  if (!params) {
    return {}
  }
  if (typeof params === 'object') {
    return params
  }
  if (typeof params !== 'string') {
    return {}
  }
  try {
    return JSON.parse(params)
  } catch {
    const result = {}
    for (const pair of params.split('&')) {
      const [key, value] = pair.split('=')
      if (key) {
        result[decodeURIComponent(key)] = decodeURIComponent(value || '')
      }
    }
    return result
  }
}

