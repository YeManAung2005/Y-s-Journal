export function formatMoney(micros) {
  if (micros === null || micros === undefined) return 'Unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(micros / 1_000_000)
}

export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return '—'
  return `${(Number(ratio) * 100).toFixed(1)}%`
}

export function formatMultiple(value) {
  if (value === null || value === undefined) return '—'
  if (value === 'Infinity') return '∞'
  return Number(value).toFixed(2)
}

export function formatInteger(value) {
  if (value === null || value === undefined) return '—'
  return String(value)
}
