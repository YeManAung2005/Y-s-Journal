import { z } from 'zod'
import { isValidTimeZone } from '../../server/lib/timezone.js'

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(200, 'Password must be at most 200 characters.')
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.')

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is required.')
  .max(254, 'Email is too long.')
  .email('Enter a valid email address.')

export const onboardingSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(1, 'Display name is required.').max(80),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(200),
})

export const unlockSchema = z.object({
  password: z.string().min(1, 'Password is required.').max(200),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.').max(200),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'New passwords do not match.',
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'The new password must be different from the current password.',
  })

const timeZoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine(isValidTimeZone, 'Enter a valid IANA time zone.')

const reminderTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 20:00.')

export const settingsPatchSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']).optional(),
    fontScale: z.number().min(0.8).max(1.5).optional(),
    reducedMotion: z.boolean().optional(),
    appTimeZone: timeZoneSchema.optional(),
    tradingTimeZone: timeZoneSchema.optional(),
    dailyStudyTargetMinutes: z.number().int().min(0).max(720).optional(),
    calendarJournalIndicator: z.boolean().optional(),
    reminders: z
      .object({
        journalEnabled: z.boolean().optional(),
        journalTime: reminderTimeSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const securityEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
