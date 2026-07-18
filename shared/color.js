const HEX_COLOR = /^[0-9A-F]{6}$/i

export function normalizeHexColor(value) {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().replace(/^#/, '').toUpperCase()
  return HEX_COLOR.test(normalized) ? normalized : null
}

export function hexToNumber(value, fallback = 0x3b82f6) {
  const normalized = normalizeHexColor(value)
  return normalized ? Number.parseInt(normalized, 16) : fallback
}

export function relativeLuminance(value) {
  const normalized = normalizeHexColor(value)
  if (!normalized) {
    return 0
  }

  const channels = [0, 2, 4].map((offset) => {
    const component = Number.parseInt(normalized.slice(offset, offset + 2), 16)
    const sRgb = component / 255
    return sRgb <= 0.03928
      ? sRgb / 12.92
      : ((sRgb + 0.055) / 1.055) ** 2.4
  })

  return (
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  )
}

export function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function readableAccent(
  primary,
  alternate,
  fallback = '3B82F6',
  background = '000000',
) {
  const candidates = [primary, alternate, fallback]
  for (const candidate of candidates) {
    const normalized = normalizeHexColor(candidate)
    if (normalized && contrastRatio(normalized, background) >= 3) {
      return normalized
    }
  }
  return fallback
}

