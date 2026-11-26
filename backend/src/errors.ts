import type { ErrorCode } from '@trailkin/shared'

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
}

export class AppError extends Error {
  readonly statusCode: number

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusByCode[code]
  }
}
