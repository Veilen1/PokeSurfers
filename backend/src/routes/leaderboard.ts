import type { FastifyPluginAsync } from 'fastify'
import { leaderboardQuerySchema } from '@trailkin/shared'
import { parseInput } from '../validation.js'
import type { IGameRepository } from '../repository.js'

export interface LeaderboardRouteOptions {
  repository: IGameRepository
}

export const leaderboardRoutes: FastifyPluginAsync<LeaderboardRouteOptions> = async (app, options) => {
  app.get('/leaderboard', async (request) => {
    const query = parseInput(leaderboardQuerySchema, request.query)
    return { leaders: await options.repository.getLeaderboard(query.limit) }
  })
}
