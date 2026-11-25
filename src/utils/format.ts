export function formatMacAddress(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  const hex = value.replace(/[^0-9a-f]/gi, '').toUpperCase()

  if (hex.length !== 12) {
    return value
  }

  return (hex.match(/.{2}/g) ?? []).join(':')
}
