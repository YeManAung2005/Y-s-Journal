import { z } from 'zod'

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month in YYYY-MM format.')

export const calendarQuerySchema = z
  .object({
    month: monthSchema,
  })
  .strict()
