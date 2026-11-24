export function formatMacAddress(value: string): string {
  const normalized = value.trim()

  if (!/^[0-9a-f]{12}$/.test(normalized)) {
    return value
  }

  const pairs = normalized.match(/.{2}/g) ?? []
  return pairs.join(':').toUpperCase()
}
