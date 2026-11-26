import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { PlayerProfile, SubmitRunRequest } from '@trailkin/shared'
import { AuthService } from './auth.js'
import { AppError } from './errors.js'
import type { IGameRepository } from './repository.js'
import { createServer } from './server.js'

const profile: PlayerProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  displayName: 'fernrunner',
  coins: 0,
  selectedCreatureId: 'bulbasaur',
  selectedFormId: 'bulbasaur',
  unlockedCreatureIds: ['bulbasaur', 'charmander', 'squirtle'],
  progress: {
    bulbasaur: { xp: 0, level: 1 },
    charmander: { xp: 0, level: 1 },
    squirtle: { xp: 0, level: 1 },
  },
}

describe('account session routes', () => {
  let app: FastifyInstance
  let auth: AuthService
  let passwordHash: string
  let existingUsername: boolean

  beforeEach(async () => {
    auth = new AuthService('local-test-secret-that-is-long-enough-123456', false)
    passwordHash = await auth.hashPassword('correct-horse-battery')
    existingUsername = false
    const repository: IGameRepository = {
      healthCheck: async () => true,
      createAccount: async (username, _passwordHash) => {
        if (existingUsername) throw new AppError('CONFLICT', 'That username is already in use')
        existingUsername = true
        return { ...profile, displayName: username }
      },
      findCredentials: async (username) => username === 'fernrunner'
        ? { id: profile.id, passwordHash }
        : null,
      getProfile: async (userId) => userId === profile.id ? profile : null,
      listCreatures: async () => [],
      selectCreature: async () => profile,
      purchaseCreature: async () => profile,
      submitRun: async (_userId: string, _input: SubmitRunRequest) => ({
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
    app = await createServer({ repository, auth, webOrigin: 'http://localhost:5173' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('creates an account and establishes a signed-in session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'fernrunner', password: 'correct-horse-battery' },
    })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ profile: { displayName: 'fernrunner' } })
    const cookie = cookieHeader(response.headers['set-cookie'])

    const currentUser = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    })
    expect(currentUser.statusCode).toBe(200)
    expect(currentUser.json()).toMatchObject({ id: profile.id, displayName: 'fernrunner' })
  })

  it('rejects duplicate accounts and invalid credentials', async () => {
    existingUsername = true
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'fernrunner', password: 'correct-horse-battery' },
    })
    expect(duplicate.statusCode).toBe(409)

    const badLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'fernrunner', password: 'wrong-password' },
    })
    expect(badLogin.statusCode).toBe(401)
  })

  it('rejects protected requests without a valid signed token', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/profile' })
    expect(anonymous.statusCode).toBe(401)

    const tampered = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { cookie: 'trailkin_session=not.a.valid.token' },
    })
    expect(tampered.statusCode).toBe(401)
  })

  it('clears the browser session on logout', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'fernrunner', password: 'correct-horse-battery' },
    })
    expect(login.statusCode).toBe(200)
    const cookie = cookieHeader(login.headers['set-cookie'])
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    })
    expect(logout.statusCode).toBe(200)
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0')

    const anonymous = await app.inject({ method: 'GET', url: '/api/profile' })
    expect(anonymous.statusCode).toBe(401)
  })
})

function cookieHeader(value: string | string[] | undefined): string {
  const cookie = Array.isArray(value) ? value[0] : value
  if (!cookie) throw new Error('Expected an authentication cookie')
  return cookie.split(';', 1)[0]
}
