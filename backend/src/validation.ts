import type { ZodType } from 'zod'
import { AppError } from './errors.js'

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'The request contains invalid values',
      { issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) },
    )
  }
  return result.data
}
