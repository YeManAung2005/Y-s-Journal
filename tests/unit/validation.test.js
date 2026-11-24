import { describe, expect, it } from 'vitest'
import {
  changePasswordSchema,
  onboardingSchema,
  settingsPatchSchema,
} from '../../src/shared/validation/auth.js'

describe('Phase 1 validation schemas', () => {
  const validOwner = {
    email: ' Owner@Example.COM ',
    displayName: 'Owner',
    password: 'secure-passphrase-123',
    confirmPassword: 'secure-passphrase-123',
  }

  it('normalizes owner email and accepts a valid onboarding payload', () => {
    const parsed = onboardingSchema.parse(validOwner)
    expect(parsed.email).toBe('owner@example.com')
  })

  it('rejects weak or mismatched passwords', () => {
    expect(() => onboardingSchema.parse({ ...validOwner, password: 'short123' })).toThrow()
    expect(() =>
      onboardingSchema.parse({ ...validOwner, confirmPassword: 'different-123' }),
    ).toThrow()
  })

  it('rejects unknown settings keys and invalid time zones', () => {
    expect(() => settingsPatchSchema.parse({ theme: 'light' })).not.toThrow()
    expect(() => settingsPatchSchema.parse({ unknownSetting: true })).toThrow()
    expect(() => settingsPatchSchema.parse({ appTimeZone: 'Mars/Olympus' })).toThrow()
  })

  it('requires a different new password when changing passwords', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'secure-passphrase-123',
        newPassword: 'secure-passphrase-123',
        confirmNewPassword: 'secure-passphrase-123',
      }),
    ).toThrow()
  })
})
