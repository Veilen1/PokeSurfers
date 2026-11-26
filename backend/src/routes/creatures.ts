import type { FastifyPluginAsync } from 'fastify'
import { selectCreatureSchema } from '@trailkin/shared'
import type { IAuthService } from '../auth.js'
import { requireAuthentication } from '../auth.js'
import { parseInput } from '../validation.js'
import type { IGameRepository } from '../repository.js'

export interface CreatureRouteOptions {
  auth: IAuthService
  repository: IGameRepository
}

export const creatureRoutes: FastifyPluginAsync<CreatureRouteOptions> = async (app, options) => {
  app.get('/creatures', { preHandler: requireAuthentication(options.auth) }, async (request) => ({
    creatures: await options.repository.listCreatures(request.userId!),
  }))

  app.post('/creatures/select', { preHandler: requireAuthentication(options.auth) }, async (request) => {
    const input = parseInput(selectCreatureSchema, request.body)
    return { profile: await options.repository.selectCreature(request.userId!, input.creatureId, input.formId) }
  })
}
