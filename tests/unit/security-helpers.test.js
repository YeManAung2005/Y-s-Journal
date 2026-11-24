import { describe, expect, it } from 'vitest'
import { progressiveDelay } from '../../src/server/services/auth-service.js'
import {
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} from '../../src/server/lib/password.js'
import { createOpaqueToken, safeEqual, sha256 } from '../../src/server/lib/tokens.js'
import { isValidTimeZone } from '../../src/server/lib/timezone.js'
import { isIdleExpired, AUTO_LOCK_MS } from '../../src/client/lib/idle.js'

describe('security primitives', () => {
  it('hashes passwords with Argon2id and verifies them', async () => {
    const hash = await hashPassword('a-valid-passphrase-123')

    expect(hash).toMatch(/^\$argon2id\$/)
    await expect(verifyPassword(hash, 'a-valid-passphrase-123')).resolves.toBe(true)
    await expect(verifyPassword(hash, 'wrong-passphrase')).resolves.toBe(false)
  })

  it('creates a stable dummy hash for unknown-account timing', async () => {
    const first = await getDummyPasswordHash()
    const second = await getDummyPasswordHash()
    expect(first).toBe(second)
  })

  it('hashes tokens deterministically and compares them in constant time', () => {
    const token = createOpaqueToken()
    expect(token).not.toContain('+')
    expect(sha256(token)).toHaveLength(64)
    expect(safeEqual(sha256(token), sha256(token))).toBe(true)
    expect(safeEqual(sha256(token), sha256(createOpaqueToken()))).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual(undefined, 'abc')).toBe(false)
  })

  it('caps progressive login delay and ignores invalid counts', () => {
    expect(progressiveDelay(0)).toBe(0)
    expect(progressiveDelay(-3)).toBe(0)
    expect(progressiveDelay(1)).toBe(200)
    expect(progressiveDelay(2)).toBe(400)
    expect(progressiveDelay(20)).toBe(3000)
  })

  it('validates IANA time zones', () => {
    expect(isValidTimeZone('Asia/Yangon')).toBe(true)
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })

  it('detects idle expiry at the 15-minute boundary', () => {
    const now = 1_000_000
    expect(isIdleExpired(now - AUTO_LOCK_MS + 1, now)).toBe(false)
    expect(isIdleExpired(now - AUTO_LOCK_MS, now)).toBe(true)
    expect(isIdleExpired(Number.NaN, now)).toBe(false)
  })
})
