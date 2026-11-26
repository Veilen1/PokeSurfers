import type { FastifyPluginAsync } from 'fastify'
import { credentialsSchema } from '@trailkin/shared'
import type { IAuthService } from '../auth.js'
import { requireAuthentication } from '../auth.js'
import type { IGameRepository } from '../repository.js'
import { AppError } from '../errors.js'
import { parseInput } from '../validation.js'

export interface AuthRouteOptions {
  auth: IAuthService
  repository: IGameRepository
}

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  const { auth, repository } = options

  app.post('/auth/register', async (request, reply) => {
    const input = parseInput(credentialsSchema, request.body)
    const passwordHash = await auth.hashPassword(input.password)
    const profile = await repository.createAccount(input.username, passwordHash)
    auth.issueSession(profile.id, reply)
    return reply.code(201).send({ profile })
  })

  app.post('/auth/login', async (request, reply) => {
    const input = parseInput(credentialsSchema, request.body)
    const account = await repository.findCredentials(input.username)
    const valid = account
      ? await auth.verifyPassword(input.password, account.passwordHash)
      : await auth.verifyPassword(input.password, 'scrypt$invalid$00')
    if (!account || !valid) {
      throw new AppError('UNAUTHORIZED', 'Username or password is incorrect')
    }
    const profile = await repository.getProfile(account.id)
    if (!profile) throw new AppError('UNAUTHORIZED', 'Username or password is incorrect')
    auth.issueSession(account.id, reply)
    return reply.code(200).send({ profile })
  })

  app.post('/auth/logout', async (_request, reply) => {
    auth.revokeSession(reply)
    return reply.code(200).send({ status: 'signed_out' })
  })

  app.get('/auth/me', { preHandler: requireAuthentication(auth) }, async (request) => {
    const profile = await repository.getProfile(request.userId!)
    if (!profile) throw new AppError('UNAUTHORIZED', 'Session is no longer valid')
    return profile
  })
}
