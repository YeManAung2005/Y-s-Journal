export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

let csrfToken = null

async function readPayload(response) {
  return response.json().catch(() => null)
}

export async function ensureCsrf({ force = false } = {}) {
  if (csrfToken && !force) return csrfToken

  const response = await fetch('/api/v1/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })

  const payload = await readPayload(response)
  if (!response.ok || !payload?.data?.csrfToken) {
    throw new ApiError('Could not initialize a secure session.', {
      status: response.status,
      code: payload?.error?.code,
    })
  }

  csrfToken = payload.data.csrfToken
  return csrfToken
}

export function resetCsrfToken() {
  csrfToken = null
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const upperMethod = method.toUpperCase()
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)

  const send = async () => {
    const headers = { accept: 'application/json' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (mutating) headers['x-csrf-token'] = await ensureCsrf()

    return fetch(`/api/v1${path}`, {
      method: upperMethod,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let response = await send()
  let payload = await readPayload(response)

  if (response.status === 403 && payload?.error?.code === 'CSRF_INVALID') {
    await ensureCsrf({ force: true })
    response = await send()
    payload = await readPayload(response)
  }

  if (!response.ok || payload?.error) {
    throw new ApiError(payload?.error?.message || `Request failed (${response.status}).`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    })
  }

  return payload?.data
}

export async function fetchHealth() {
  const response = await fetch('/api/v1/health', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })

  const body = await readPayload(response)

  if (!body?.data) {
    throw new Error('The API returned an invalid health response.')
  }

  return body.data
}
