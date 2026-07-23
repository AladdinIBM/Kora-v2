import { normalizeLogoCatalogTransferState } from './logo-catalog-transfer.js'
import { asString, isObject } from './validation.js'

export const ACTIVE_LOGO_CATALOG_SCHEMA_VERSION = 1

export function normalizeActiveLogoCatalog(value) {
  if (!isObject(value)) {
    return {
      schemaVersion: ACTIVE_LOGO_CATALOG_SCHEMA_VERSION,
      season: null,
      assets: {},
      activatedAt: 0,
      cleanupPaths: [],
    }
  }

  const season = /^\d{4}-07-01$/.test(asString(value.season))
    ? asString(value.season)
    : null
  const assets = {}
  for (const [teamId, asset] of Object.entries(value.assets || {})) {
    if (
      /^[A-Za-z0-9_-]{1,64}$/.test(teamId) &&
      isObject(asset) &&
      asString(asset.localPath).startsWith('data://') &&
      asString(asset.revision) &&
      Number(asset.byteLength) > 0
    ) {
      assets[teamId] = {
        teamId,
        localPath: asString(asset.localPath),
        revision: asString(asset.revision),
        byteLength: Number(asset.byteLength),
      }
    }
  }

  return {
    schemaVersion: ACTIVE_LOGO_CATALOG_SCHEMA_VERSION,
    season,
    assets,
    activatedAt: Number(value.activatedAt) || 0,
    cleanupPaths: Array.isArray(value.cleanupPaths)
      ? [...new Set(
          value.cleanupPaths
            .map((localPath) => asString(localPath))
            .filter((localPath) => localPath.startsWith('data://')),
        )]
      : [],
  }
}

function sameCatalog(left, right) {
  if (left.season !== right.season) return false
  const leftAssets = Object.values(left.assets)
  const rightAssets = Object.values(right.assets)
  if (leftAssets.length !== rightAssets.length) return false
  return rightAssets.every(
    (asset) =>
      left.assets[asset.teamId]?.revision === asset.revision &&
      left.assets[asset.teamId]?.localPath === asset.localPath,
  )
}

export function planLogoCatalogActivation(
  activeValue,
  transferValue,
  nowMs = Date.now(),
) {
  const current = normalizeActiveLogoCatalog(activeValue)
  const transfer = normalizeLogoCatalogTransferState(transferValue)
  const expected = Object.values(transfer.expectedAssets)
  const received = Object.values(transfer.assets)

  if (
    !transfer.season ||
    !['ready', 'active'].includes(transfer.status) ||
    transfer.totalTeams <= 0 ||
    expected.length !== transfer.totalTeams ||
    received.length !== transfer.totalTeams
  ) {
    return { activated: false, active: current, transfer, stalePaths: [] }
  }

  const assets = {}
  for (const expectedAsset of expected) {
    const asset = transfer.assets[expectedAsset.teamId]
    if (
      !asset ||
      asset.revision !== expectedAsset.revision ||
      asset.byteLength !== expectedAsset.byteLength
    ) {
      return { activated: false, active: current, transfer, stalePaths: [] }
    }
    assets[expectedAsset.teamId] = {
      teamId: expectedAsset.teamId,
      localPath: asset.localPath,
      revision: asset.revision,
      byteLength: asset.byteLength,
    }
  }

  const next = {
    schemaVersion: ACTIVE_LOGO_CATALOG_SCHEMA_VERSION,
    season: transfer.season,
    assets,
    activatedAt: Number(nowMs) || Date.now(),
    cleanupPaths: [],
  }
  if (sameCatalog(current, next)) {
    return {
      activated: false,
      active: current,
      transfer: { ...transfer, status: 'active' },
      stalePaths: current.cleanupPaths,
    }
  }

  const nextPaths = new Set(
    Object.values(next.assets).map((asset) => asset.localPath),
  )
  const stalePaths = [
    ...new Set(
      Object.values(current.assets)
        .map((asset) => asset.localPath)
        .filter((localPath) => !nextPaths.has(localPath)),
    ),
  ]
  next.cleanupPaths = stalePaths
  return {
    activated: true,
    active: next,
    transfer: { ...transfer, status: 'active' },
    stalePaths,
  }
}
