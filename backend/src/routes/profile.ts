import type { FastifyPluginAsync } from 'fastify'
import type { IAuthService } from '../auth.js'
import { requireAuthentication } from '../auth.js'
import { AppError } from '../errors.js'
import type { IGameRepository } from '../repository.js'

export interface ProfileRouteOptions {
  auth: IAuthService
  repository: IGameRepository
}

export const profileRoutes: FastifyPluginAsync<ProfileRouteOptions> = async (app, options) => {
  app.get('/profile', { preHandler: requireAuthentication(options.auth) }, async (request) => {
    const profile = await options.repository.getProfile(request.userId!)
    if (!profile) throw new AppError('NOT_FOUND', 'Player profile was not found')
    return profile
  })
}
