import { Algorithm, hash, verify } from '@node-rs/argon2'

export const ARGON2_OPTIONS = Object.freeze({
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
})

export async function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHashPromise = null

export function getDummyPasswordHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('ys-journal-dummy-password-value-0000')
  }
  return dummyHashPromise
}
