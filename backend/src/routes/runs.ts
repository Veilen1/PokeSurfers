import { submitRunSchema, isValidRun, rewardsForRun } from '@trailkin/shared'
import type { FastifyPluginAsync } from 'fastify'
import type { IAuthService } from '../auth.js'
import { requireAuthentication } from '../auth.js'
import { AppError } from '../errors.js'
import { parseInput } from '../validation.js'
import type { IGameRepository } from '../repository.js'

export interface RunRouteOptions {
  auth: IAuthService
  repository: IGameRepository
}

export const runRoutes: FastifyPluginAsync<RunRouteOptions> = async (app, options) => {
  app.post('/runs', { preHandler: requireAuthentication(options.auth) }, async (request, reply) => {
    const input = parseInput(submitRunSchema, request.body)
    if (!isValidRun(input.score, input.durationMs, input.collectedCoins)) {
      throw new AppError('VALIDATION_ERROR', 'Run results exceed the allowed score or pickup limits')
    }
    const result = await options.repository.submitRun(
      request.userId!,
      input,
      rewardsForRun(input.score, input.durationMs, input.collectedCoins),
    )
    return reply.code(201).send(result)
  })
}
