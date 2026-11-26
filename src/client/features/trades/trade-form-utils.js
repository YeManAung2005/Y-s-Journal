/** Blank optional fields stay missing instead of becoming zero or an empty string. */
export function optionalValue(value) {
  const normalized = value === null || value === undefined ? '' : String(value).trim()
  return normalized === '' ? null : normalized
}
