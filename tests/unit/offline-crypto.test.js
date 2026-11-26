import '../helpers/offline.js'
import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
  decryptJson,
  deriveCacheKey,
  deriveVerifier,
  encryptJson,
  randomId,
} from '../../src/client/offline/crypto.js'

describe('offline crypto', () => {
  it('round-trips binary data through base64, including padded inputs', () => {
    const samples = [
      new Uint8Array([0, 1, 2, 127, 128, 254, 255]),
      new Uint8Array([65]),
      new Uint8Array([65, 66]),
      new Uint8Array([65, 66, 67]),
    ]

    for (const bytes of samples) {
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
    }
  })

  it('derives a non-extractable AES-GCM key and encrypts JSON', async () => {
    const key = await deriveCacheKey('secure-passphrase-123', 'owner-1')
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })

    const encrypted = await encryptJson({ entry: 'private reflection', mood: 'calm' }, key)
    expect(encrypted.payload).not.toContain('private reflection')
    expect(await decryptJson(encrypted, key)).toEqual({ entry: 'private reflection', mood: 'calm' })
  })

  it('fails decryption with a different key or modified payload', async () => {
    const key = await deriveCacheKey('secure-passphrase-123', 'owner-1')
    const otherKey = await deriveCacheKey('secure-passphrase-123', 'owner-2')
    const encrypted = await encryptJson({ value: 'secret' }, key)

    await expect(decryptJson(encrypted, otherKey)).rejects.toThrow()
    await expect(
      decryptJson({ ...encrypted, payload: `${encrypted.payload.slice(0, -2)}AA` }, key),
    ).rejects.toThrow()
  })

  it('derives a stable verifier that is distinct from the cache key input', async () => {
    const first = await deriveVerifier('secure-passphrase-123', 'owner-1')
    const repeat = await deriveVerifier('secure-passphrase-123', 'owner-1')
    const wrongPassword = await deriveVerifier('wrong-passphrase', 'owner-1')
    const wrongOwner = await deriveVerifier('secure-passphrase-123', 'owner-2')

    expect(first).toBe(repeat)
    expect(first).not.toBe(wrongPassword)
    expect(first).not.toBe(wrongOwner)
    expect(constantTimeEqual(first, repeat)).toBe(true)
    expect(constantTimeEqual(first, wrongPassword)).toBe(false)
    expect(constantTimeEqual(first, 'short')).toBe(false)
  })

  it('generates random operation IDs', () => {
    const first = randomId()
    const second = randomId()
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThanOrEqual(8)
  })
})
