export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function asString(value, fallback = '') {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return fallback
}

export function asNullableString(value) {
  const normalized = asString(value)
  return normalized || null
}

export function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = asString(value)
    if (normalized) {
      return normalized
    }
  }
  return ''
}

export function toFiniteNumber(value, fallback = null) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function isValidIsoTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

export function parseJsonBody(body, InvalidError) {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch (error) {
      throw new InvalidError('Response body contains invalid JSON', {
        cause: error.message,
      })
    }
  }
  if (isObject(body)) {
    return body
  }
  throw new InvalidError('Response body must be an object or JSON string')
}

export function stableUniqueBy(items, keySelector) {
  const seen = new Set()
  const result = []
  for (const item of asArray(items)) {
    const key = keySelector(item)
    if (!key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(item)
  }
  return result
}

