export async function fetchHealth() {
  const response = await fetch('/api/v1/health', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })

  const body = await response.json().catch(() => null)

  if (!body?.data) {
    throw new Error('The API returned an invalid health response.')
  }

  return body.data
}
