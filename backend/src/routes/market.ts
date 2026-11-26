import type { FastifyPluginAsync } from 'fastify'
import { purchaseSchema } from '@trailkin/shared'
import type { IAuthService } from '../auth.js'
import { requireAuthentication } from '../auth.js'
import { parseInput } from '../validation.js'
import type { IGameRepository } from '../repository.js'

export interface MarketRouteOptions {
  auth: IAuthService
  repository: IGameRepository
}

export const marketRoutes: FastifyPluginAsync<MarketRouteOptions> = async (app, options) => {
  app.get('/market', { preHandler: requireAuthentication(options.auth) }, async (request) => ({
    offers: (await options.repository.listCreatures(request.userId!)).filter((creature) => !creature.starter),
  }))

  app.post('/market/purchase', { preHandler: requireAuthentication(options.auth) }, async (request) => {
    const input = parseInput(purchaseSchema, request.body)
    return { profile: await options.repository.purchaseCreature(request.userId!, input.creatureId) }
  })
}
