import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}
