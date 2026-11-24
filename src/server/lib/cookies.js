import { createOpaqueToken } from './tokens.js'

export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000
export const CSRF_TOKEN_BYTES = 32

export function sessionCookieName(config) {
  return config.nodeEnv === 'production' ? '__Host-ysj_sid' : 'ysj_sid'
}

export function csrfCookieName(config) {
  return config.nodeEnv === 'production' ? '__Host-ysj_csrf' : 'ysj_csrf'
}

export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_IDLE_MS,
  }
}

export function csrfCookieOptions(config) {
  return {
    httpOnly: false,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
  }
}

export function createCsrfToken() {
  return createOpaqueToken(CSRF_TOKEN_BYTES)
}

export function setSessionCookie(res, token, config) {
  res.cookie(sessionCookieName(config), token, sessionCookieOptions(config))
}

export function clearSessionCookie(res, config) {
  res.clearCookie(sessionCookieName(config), {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/',
  })
}

export function readSessionCookie(req, config) {
  return req.cookies?.[sessionCookieName(config)] ?? null
}
