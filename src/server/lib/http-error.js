export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function validationError(error) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'The submitted data is invalid.',
    error?.issues?.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  )
}

export function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw validationError(result.error)
  }
  return result.data
}
