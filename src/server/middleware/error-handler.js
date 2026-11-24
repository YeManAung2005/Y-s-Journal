export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  req.log?.error({ err: error }, 'Unhandled request error')

  const status = Number.isInteger(error.status) ? error.status : 500
  const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR')

  res.status(status).json({
    error: {
      code,
      message: status === 500 ? 'An unexpected error occurred.' : error.message,
      requestId: req.id,
    },
  })
}
