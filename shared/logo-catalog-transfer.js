import { asArray, asString, isObject } from './validation.js'

export const LOGO_CATALOG_TRANSFER_SCHEMA_VERSION = 1

function validSeason(value) {
  const season = asString(value)
  return /^\d{4}-07-01$/.test(season) ? season : null
}

function validTeamId(value) {
  const teamId = asString(value)
  return /^[A-Za-z0-9_-]{1,64}$/.test(teamId) ? teamId : null
}

function normalizeManifestAsset(value) {
  if (!isObject(value)) return null
  const teamId = validTeamId(value.teamId)
  const revision = asString(value.revision)
  const byteLength = Number(value.byteLength)
  if (!teamId || !revision || !Number.isFinite(byteLength) || byteLength <= 0) {
    return null
  }
  return { teamId, revision, byteLength }
}

export function normalizeLogoCatalogTransferManifest(value) {
  if (!isObject(value)) return null
  const season = validSeason(value.season)
  const assets = asArray(value.assets)
    .map(normalizeManifestAsset)
    .filter(Boolean)
  const uniqueAssets = []
  const seen = new Set()
  for (const asset of assets) {
    if (seen.has(asset.teamId)) continue
    seen.add(asset.teamId)
    uniqueAssets.push(asset)
  }
  if (!season || !uniqueAssets.length) return null
  return {
    schemaVersion: LOGO_CATALOG_TRANSFER_SCHEMA_VERSION,
    season,
    totalTeams: uniqueAssets.length,
    assets: uniqueAssets,
  }
}

export function normalizeLogoCatalogTransferState(value) {
  if (!isObject(value)) {
    return {
      schemaVersion: LOGO_CATALOG_TRANSFER_SCHEMA_VERSION,
      season: null,
      status: 'idle',
      totalTeams: 0,
      expectedAssets: {},
      assets: {},
    }
  }

  const season = validSeason(value.season)
  const expectedAssets = {}
  const assets = {}
  const expectedSource = Array.isArray(value.expectedAssets)
    ? value.expectedAssets
    : Object.values(value.expectedAssets || {})
  for (const asset of expectedSource) {
    const normalized = normalizeManifestAsset(asset)
    if (normalized) expectedAssets[normalized.teamId] = normalized
  }
  for (const [teamId, asset] of Object.entries(value.assets || {})) {
    const normalizedId = validTeamId(teamId)
    if (
      normalizedId &&
      isObject(asset) &&
      typeof asset.localPath === 'string' &&
      asset.localPath.startsWith('data://') &&
      asString(asset.revision)
    ) {
      assets[normalizedId] = {
        teamId: normalizedId,
        localPath: asset.localPath,
        revision: asString(asset.revision),
        byteLength: Number(asset.byteLength) || 0,
        receivedAt: Number(asset.receivedAt) || 0,
      }
    }
  }

  const totalTeams = Math.max(
    0,
    Number(value.totalTeams) || Object.keys(expectedAssets).length,
  )
  return {
    schemaVersion: LOGO_CATALOG_TRANSFER_SCHEMA_VERSION,
    season,
    status: asString(value.status) || 'idle',
    totalTeams,
    expectedAssets,
    assets,
    startedAt: Number(value.startedAt) || 0,
    completedAt: Number(value.completedAt) || 0,
  }
}

export function beginLogoCatalogTransfer(currentValue, manifestValue) {
  const current = normalizeLogoCatalogTransferState(currentValue)
  const manifest = normalizeLogoCatalogTransferManifest(manifestValue)
  if (!manifest) return current

  const sameSeason = current.season === manifest.season
  const expectedAssets = Object.fromEntries(
    manifest.assets.map((asset) => [asset.teamId, asset]),
  )
  const assets = {}
  if (sameSeason) {
    for (const [teamId, asset] of Object.entries(current.assets)) {
      if (expectedAssets[teamId]?.revision === asset.revision) {
        assets[teamId] = asset
      }
    }
  }
  const complete = Object.keys(assets).length === manifest.totalTeams
  return {
    schemaVersion: LOGO_CATALOG_TRANSFER_SCHEMA_VERSION,
    season: manifest.season,
    status: complete ? 'ready' : 'receiving',
    totalTeams: manifest.totalTeams,
    expectedAssets,
    assets,
    startedAt: sameSeason && current.startedAt ? current.startedAt : Date.now(),
    completedAt: complete ? current.completedAt || Date.now() : 0,
  }
}

export function recordReceivedCatalogLogo(currentValue, payload) {
  const current = normalizeLogoCatalogTransferState(currentValue)
  const season = validSeason(payload && payload.season)
  const teamId = validTeamId(payload && payload.teamId)
  const revision = asString(payload && payload.revision)
  const localPath = asString(payload && payload.localPath)
  const byteLength = Number(payload && payload.byteLength)
  const totalTeams = Number(payload && payload.totalTeams)
  if (
    !season ||
    !teamId ||
    !revision ||
    !localPath.startsWith('data://') ||
    !Number.isFinite(byteLength) ||
    byteLength <= 0 ||
    !Number.isFinite(totalTeams) ||
    totalTeams <= 0
  ) {
    return { accepted: false, complete: false, state: current }
  }

  const base = current.season === season
    ? current
    : {
        schemaVersion: LOGO_CATALOG_TRANSFER_SCHEMA_VERSION,
        season,
        status: 'receiving',
        totalTeams,
        expectedAssets: {},
        assets: {},
        startedAt: Date.now(),
        completedAt: 0,
      }
  const expected = base.expectedAssets[teamId]
  if (
    (Object.keys(base.expectedAssets).length > 0 && !expected) ||
    (expected &&
      (expected.revision !== revision || expected.byteLength !== byteLength))
  ) {
    return { accepted: false, complete: false, state: base }
  }

  const assets = {
    ...base.assets,
    [teamId]: {
      teamId,
      localPath,
      revision,
      byteLength,
      receivedAt: Date.now(),
    },
  }
  const effectiveTotal = base.totalTeams || totalTeams
  const complete = Object.keys(assets).length === effectiveTotal
  return {
    accepted: true,
    complete,
    state: {
      ...base,
      status: complete ? 'ready' : 'receiving',
      totalTeams: effectiveTotal,
      assets,
      completedAt: complete ? Date.now() : 0,
    },
  }
}

export function receivedCatalogAssets(value) {
  const state = normalizeLogoCatalogTransferState(value)
  return Object.values(state.assets).map(({ teamId, revision }) => ({
    teamId,
    revision,
  }))
}
