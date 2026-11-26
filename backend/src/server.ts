import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { pathToFileURL } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import type { HealthResponse } from '@trailkin/shared'
import type { IAuthService } from './auth.js'
import { loadConfig } from './config.js'
import { AppError } from './errors.js'
import type { IGameRepository } from './repository.js'
import { getServices, closeServices } from './services/registry.js'
import { authRoutes } from './routes/auth.js'
import { creatureRoutes } from './routes/creatures.js'
import { leaderboardRoutes } from './routes/leaderboard.js'
import { marketRoutes } from './routes/market.js'
import { profileRoutes } from './routes/profile.js'
import { runRoutes } from './routes/runs.js'

export interface ServerDependencies {
  repository: IGameRepository
  auth: IAuthService
  webOrigin?: string
}

export async function createServer(dependencies: ServerDependencies = getServices()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.cookie', 'req.headers.authorization'],
    },
  })

  app.decorateRequest('userId', undefined)
  await app.register(cookie)
  await app.register(cors, {
    origin: dependencies.webOrigin ?? false,
    credentials: true,
  })
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      request.log.info({ code: error.code }, 'Request rejected')
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      })
    }

    if (typeof error === 'object' && error !== null && 'statusCode' in error
      && typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: {
          code: 'BAD_REQUEST',
          message: 'The request could not be processed',
        },
      })
    }

    request.log.error({ err: error }, 'Unhandled request failure')
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    })
  })

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({
    error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found' },
  }))

  app.get<{ Reply: HealthResponse }>('/api/health', async (_request, reply) => {
    const databaseHealthy = await dependencies.repository.healthCheck()
    const status = databaseHealthy ? 'healthy' : 'unhealthy'
    return reply.code(databaseHealthy ? 200 : 503).send({
      status,
      services: { postgresql: databaseHealthy ? 'healthy' : 'unhealthy' },
    })
  })

  app.get('/api/openapi.json', async () => openApiDocument)
  await app.register(authRoutes, { prefix: '/api', ...dependencies })
  await app.register(profileRoutes, { prefix: '/api', ...dependencies })
  await app.register(creatureRoutes, { prefix: '/api', ...dependencies })
  await app.register(marketRoutes, { prefix: '/api', ...dependencies })
  await app.register(runRoutes, { prefix: '/api', ...dependencies })
  await app.register(leaderboardRoutes, { prefix: '/api', repository: dependencies.repository })

  return app
}

const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'PokeSurfers API', version: '1.0.0' },
  servers: [{ url: '/' }],
  paths: {
    '/api/health': { get: { summary: 'Service health', responses: { '200': { description: 'Healthy or degraded' }, '503': { description: 'Unhealthy' } } } },
    '/api/auth/register': { post: { summary: 'Create a player account', responses: { '201': { description: 'Account created' }, '409': { description: 'Username already exists' } } } },
    '/api/auth/login': { post: { summary: 'Sign in', responses: { '200': { description: 'Signed in' }, '401': { description: 'Invalid credentials' } } } },
    '/api/auth/logout': { post: { summary: 'Sign out', responses: { '200': { description: 'Signed out' } } } },
    '/api/auth/me': { get: { summary: 'Get the signed-in player', responses: { '200': { description: 'Current profile' }, '401': { description: 'Not signed in' } } } },
    '/api/profile': { get: { summary: 'Get the current player profile', responses: { '200': { description: 'Profile' }, '401': { description: 'Not signed in' } } } },
    '/api/creatures': { get: { summary: 'Get creature catalog and unlock state', responses: { '200': { description: 'Creature catalog' } } } },
    '/api/creatures/select': { post: { summary: 'Select an unlocked creature form', responses: { '200': { description: 'Updated profile' }, '409': { description: 'Form not unlocked' } } } },
    '/api/market': { get: { summary: 'Get creatures available for earned-coin unlocks', responses: { '200': { description: 'Market offers' }, '401': { description: 'Not signed in' } } } },
    '/api/market/purchase': { post: { summary: 'Purchase a creature using earned sparks', responses: { '200': { description: 'Updated profile' }, '409': { description: 'Already owned' } } } },
    '/api/runs': { post: { summary: 'Submit a validated run', responses: { '201': { description: 'Run and updated profile' }, '422': { description: 'Invalid run result' } } } },
    '/api/leaderboard': { get: { summary: 'Get public high-score rankings', responses: { '200': { description: 'Leaderboard' } } } },
  },
}

async function start(): Promise<void> {
  const config = loadConfig()
  const services = getServices(config)
  const app = await createServer(services)
  app.addHook('onClose', async () => {
    await closeServices()
  })
  try {
    await app.listen({ host: '0.0.0.0', port: config.port })
  } catch (error) {
    app.log.error(error)
    await app.close()
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void start()
}
