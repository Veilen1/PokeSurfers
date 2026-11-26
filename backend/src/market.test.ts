import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { Creature, PlayerProfile, RunResult, SubmitRunRequest } from '@trailkin/shared'
import { AuthService } from './auth.js'
import type { IGameRepository } from './repository.js'
import { createServer } from './server.js'

const profile: PlayerProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  displayName: 'marketrunner',
  coins: 50,
  selectedCreatureId: 'bulbasaur',
  selectedFormId: 'bulbasaur',
  unlockedCreatureIds: ['bulbasaur'],
  progress: { bulbasaur: { xp: 0, level: 1 } },
}

const creatures: Creature[] = [
  {
    id: 'bulbasaur',
    name: 'Bulbasaur',
    element: 'Verdant',
    motif: 'leaf',
    palette: { body: '#86c979', light: '#d8efa2', dark: '#315b48' },
    starter: true,
    price: 0,
    unlocked: true,
    level: 1,
    forms: [],
  },
  {
    id: 'starly',
    name: 'Starly',
    element: 'Astral',
    motif: 'star',
    palette: { body: '#a99bec', light: '#f1d5ff', dark: '#524c8c' },
    starter: false,
    price: 35,
    unlocked: false,
    level: 1,
    forms: [],
  },
]

describe('market offers route', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
  })

  it('requires a session and returns only unlockable offers', async () => {
    const auth = new AuthService('local-test-secret-that-is-long-enough-123456', false)
    const repository: IGameRepository = {
      healthCheck: async () => true,
      createAccount: async () => profile,
      findCredentials: async () => null,
      getProfile: async () => profile,
      listCreatures: async () => creatures,
      selectCreature: async () => profile,
      purchaseCreature: async () => profile,
      submitRun: async (_userId: string, _input: SubmitRunRequest): Promise<{ run: RunResult; profile: PlayerProfile }> => ({
        run: {
          id: 'run-id',
          score: 0,
          durationMs: 1_000,
          collectedCoins: 0,
          coinsEarned: 0,
          xpEarned: 0,
          creatureId: 'bulbasaur',
          createdAt: new Date(0).toISOString(),
        },
        profile,
      }),
      getLeaderboard: async () => [],
    }
    app = await createServer({ repository, auth })
    await app.ready()

    const anonymous = await app.inject({ method: 'GET', url: '/api/market' })
    expect(anonymous.statusCode).toBe(401)

    const registration = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'marketrunner', password: 'correct-horse-battery' },
    })
    expect(registration.statusCode).toBe(201)
    const setCookie = registration.headers['set-cookie']
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';', 1)[0]
    expect(cookie).toBeTruthy()

    const response = await app.inject({
      method: 'GET',
      url: '/api/market',
      headers: { cookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ offers: [creatures[1]] })
  })
})
