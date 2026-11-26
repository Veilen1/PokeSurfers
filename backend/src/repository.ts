import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient, QueryResultRow } from 'pg'
import type {
  Creature,
  LeaderboardEntry,
  PlayerProfile,
  RunResult,
  SubmitRunRequest,
} from '@trailkin/shared'
import { creatureCatalog, levelForXp } from './catalog.js'
import { AppError } from './errors.js'

export interface IGameRepository {
  healthCheck(): Promise<boolean>
  createAccount(username: string, passwordHash: string): Promise<PlayerProfile>
  findCredentials(username: string): Promise<{ id: string; passwordHash: string } | null>
  getProfile(userId: string): Promise<PlayerProfile | null>
  listCreatures(userId: string): Promise<Creature[]>
  selectCreature(userId: string, creatureId: string, formId: string): Promise<PlayerProfile>
  purchaseCreature(userId: string, creatureId: string): Promise<PlayerProfile>
  submitRun(userId: string, input: SubmitRunRequest, rewards: { coins: number; xp: number }): Promise<{ run: RunResult; profile: PlayerProfile }>
  getLeaderboard(limit: number): Promise<LeaderboardEntry[]>
}

interface ProfileRow extends QueryResultRow {
  id: string
  username: string
  coins: number
  selected_creature_id: string
  selected_form_id: string
}

interface ProgressRow extends QueryResultRow {
  creature_id: string
  xp: number
}

export class PostgresGameRepository implements IGameRepository {
  constructor(private readonly pool: Pool) {}

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async createAccount(username: string, passwordHash: string): Promise<PlayerProfile> {
    const userId = randomUUID()
    try {
      await this.transaction(async (client) => {
        await client.query(
          'INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, $3)',
          [userId, username, passwordHash],
        )
        await client.query(
          `INSERT INTO profiles (user_id, coins, selected_creature_id, selected_form_id)
           VALUES ($1, 0, 'bulbasaur', 'bulbasaur')`,
          [userId],
        )
        for (const creature of creatureCatalog.filter((item) => item.starter)) {
          await client.query(
            'INSERT INTO unlocked_creatures (user_id, creature_id) VALUES ($1, $2)',
            [userId, creature.id],
          )
          await client.query(
            'INSERT INTO creature_progress (user_id, creature_id, xp) VALUES ($1, $2, 0)',
            [userId, creature.id],
          )
        }
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('CONFLICT', 'That username is already in use')
      }
      throw error
    }
    const profile = await this.getProfile(userId)
    if (!profile) throw new AppError('INTERNAL_ERROR', 'The account was created but its profile could not be loaded')
    return profile
  }

  async findCredentials(username: string): Promise<{ id: string; passwordHash: string } | null> {
    const result = await this.pool.query<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM accounts WHERE lower(username) = lower($1)',
      [username],
    )
    const row = result.rows[0]
    return row ? { id: row.id, passwordHash: row.password_hash } : null
  }

  async getProfile(userId: string): Promise<PlayerProfile | null> {
    return this.readProfile(this.pool, userId)
  }

  async listCreatures(userId: string): Promise<Creature[]> {
    const [unlockedResult, progressResult] = await Promise.all([
      this.pool.query<{ creature_id: string }>(
        'SELECT creature_id FROM unlocked_creatures WHERE user_id = $1',
        [userId],
      ),
      this.pool.query<ProgressRow>(
        'SELECT creature_id, xp FROM creature_progress WHERE user_id = $1',
        [userId],
      ),
    ])
    const unlocked = new Set(unlockedResult.rows.map((row) => row.creature_id))
    const levels = new Map(progressResult.rows.map((row) => [row.creature_id, levelForXp(row.xp)]))
    return creatureCatalog.map((creature) => {
      const level = levels.get(creature.id) ?? 0
      return {
        ...creature,
        unlocked: unlocked.has(creature.id),
        level,
        forms: creature.forms.map((form) => ({
          ...form,
          unlocked: unlocked.has(creature.id) && level >= form.unlockLevel,
        })),
      }
    })
  }

  async selectCreature(userId: string, creatureId: string, formId: string): Promise<PlayerProfile> {
    await this.transaction(async (client) => {
      const profile = await client.query(
        'SELECT user_id FROM profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      )
      if (profile.rowCount === 0) throw new AppError('NOT_FOUND', 'Player profile was not found')
      const creature = creatureCatalog.find((item) => item.id === creatureId)
      const form = creature?.forms.find((item) => item.id === formId)
      if (!creature || !form) throw new AppError('VALIDATION_ERROR', 'Creature or form is invalid')
      const unlocked = await client.query(
        'SELECT 1 FROM unlocked_creatures WHERE user_id = $1 AND creature_id = $2',
        [userId, creatureId],
      )
      if (unlocked.rowCount === 0) throw new AppError('FORBIDDEN', 'This creature is not unlocked')
      const progress = await client.query<{ xp: number }>(
        'SELECT xp FROM creature_progress WHERE user_id = $1 AND creature_id = $2',
        [userId, creatureId],
      )
      const xp = progress.rows[0]?.xp ?? 0
      if (levelForXp(xp) < form.unlockLevel) {
        throw new AppError('CONFLICT', 'This creature form has not been unlocked')
      }
      await client.query(
        'UPDATE profiles SET selected_creature_id = $2, selected_form_id = $3 WHERE user_id = $1',
        [userId, creatureId, formId],
      )
    })
    return this.requireProfile(userId)
  }

  async purchaseCreature(userId: string, creatureId: string): Promise<PlayerProfile> {
    const creature = creatureCatalog.find((item) => item.id === creatureId)
    if (!creature || creature.starter || creature.price <= 0) {
      throw new AppError('VALIDATION_ERROR', 'This creature is not available in the market')
    }
    await this.transaction(async (client) => {
      const profile = await client.query<{ user_id: string; coins: number }>(
        'SELECT user_id, coins FROM profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      )
      const row = profile.rows[0]
      if (!row) throw new AppError('NOT_FOUND', 'Player profile was not found')
      const unlocked = await client.query(
        'SELECT 1 FROM unlocked_creatures WHERE user_id = $1 AND creature_id = $2',
        [userId, creatureId],
      )
      if (unlocked.rowCount) throw new AppError('CONFLICT', 'This creature is already unlocked')
      if (row.coins < creature.price) throw new AppError('BAD_REQUEST', 'Not enough sparks to unlock this creature')
      await client.query('UPDATE profiles SET coins = coins - $2 WHERE user_id = $1', [userId, creature.price])
      await client.query(
        'INSERT INTO unlocked_creatures (user_id, creature_id) VALUES ($1, $2)',
        [userId, creatureId],
      )
      await client.query(
        'INSERT INTO creature_progress (user_id, creature_id, xp) VALUES ($1, $2, 0)',
        [userId, creatureId],
      )
    })
    return this.requireProfile(userId)
  }

  async submitRun(
    userId: string,
    input: SubmitRunRequest,
    rewards: { coins: number; xp: number },
  ): Promise<{ run: RunResult; profile: PlayerProfile }> {
    const runId = randomUUID()
    await this.transaction(async (client) => {
      const profile = await client.query(
        'SELECT user_id FROM profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      )
      if (profile.rowCount === 0) throw new AppError('NOT_FOUND', 'Player profile was not found')
      const unlocked = await client.query(
        'SELECT 1 FROM unlocked_creatures WHERE user_id = $1 AND creature_id = $2',
        [userId, input.creatureId],
      )
      if (unlocked.rowCount === 0) throw new AppError('FORBIDDEN', 'Runs require an unlocked creature')

      await client.query(
        `INSERT INTO runs (id, user_id, creature_id, score, coins_earned, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [runId, userId, input.creatureId, input.score, rewards.coins, input.durationMs],
      )
      await client.query(
        'UPDATE profiles SET coins = coins + $2 WHERE user_id = $1',
        [userId, rewards.coins],
      )
      await client.query(
        `INSERT INTO creature_progress (user_id, creature_id, xp) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, creature_id)
         DO UPDATE SET xp = creature_progress.xp + EXCLUDED.xp`,
        [userId, input.creatureId, rewards.xp],
      )
    })
    const profile = await this.requireProfile(userId)
    const run: RunResult = {
      id: runId,
      score: input.score,
      durationMs: input.durationMs,
      collectedCoins: input.collectedCoins,
      coinsEarned: rewards.coins,
      xpEarned: rewards.xp,
      creatureId: input.creatureId,
      createdAt: new Date().toISOString(),
    }
    return { run, profile }
  }

  async getLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    const result = await this.pool.query<{
      player: string
      best_score: number
      creature_id: string
    }>(
      `SELECT a.username AS player, MAX(r.score)::integer AS best_score, p.selected_creature_id AS creature_id
       FROM runs r
       JOIN accounts a ON a.id = r.user_id
       JOIN profiles p ON p.user_id = a.id
       GROUP BY a.id, a.username, p.selected_creature_id
       ORDER BY best_score DESC, player ASC
       LIMIT $1`,
      [limit],
    )
    return result.rows.map((row, index) => ({
      rank: index + 1,
      player: row.player,
      bestScore: row.best_score,
      creatureId: row.creature_id,
    }))
  }

  private async requireProfile(userId: string): Promise<PlayerProfile> {
    const profile = await this.getProfile(userId)
    if (!profile) throw new AppError('NOT_FOUND', 'Player profile was not found')
    return profile
  }

  private async readProfile(queryable: Pool | PoolClient, userId: string): Promise<PlayerProfile | null> {
    const profileResult = await queryable.query<ProfileRow>(
      `SELECT a.id, a.username, p.coins, p.selected_creature_id, p.selected_form_id
       FROM accounts a JOIN profiles p ON p.user_id = a.id WHERE a.id = $1`,
      [userId],
    )
    const row = profileResult.rows[0]
    if (!row) return null
    const [unlockedResult, progressResult] = await Promise.all([
      queryable.query<{ creature_id: string }>(
        'SELECT creature_id FROM unlocked_creatures WHERE user_id = $1',
        [userId],
      ),
      queryable.query<ProgressRow>(
        'SELECT creature_id, xp FROM creature_progress WHERE user_id = $1',
        [userId],
      ),
    ])
    return {
      id: row.id,
      displayName: row.username,
      coins: row.coins,
      selectedCreatureId: row.selected_creature_id,
      selectedFormId: row.selected_form_id,
      unlockedCreatureIds: unlockedResult.rows.map((item) => item.creature_id),
      progress: Object.fromEntries(progressResult.rows.map((item) => [
        item.creature_id,
        { xp: item.xp, level: levelForXp(item.xp) },
      ])),
    }
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === '23505'
}
