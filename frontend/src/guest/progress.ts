import type {
  Creature,
  LeaderboardEntry,
  PlayerProfile,
  RunResult,
  SubmitRunRequest,
} from '@trailkin/shared'
import { creatureCatalog, isValidRun, levelForXp, rewardsForRun } from '@trailkin/shared'

export const GUEST_STATE_VERSION = 1
export const GUEST_RUN_LIMIT = 50
export const GUEST_NAME = 'Guest'

export interface GuestState {
  version: number
  profile: PlayerProfile
  runs: RunResult[]
}

const starterIds = creatureCatalog.filter((creature) => creature.starter).map((creature) => creature.id)
const catalogIds = new Set(creatureCatalog.map((creature) => creature.id))

export function createGuestState(): GuestState {
  return {
    version: GUEST_STATE_VERSION,
    profile: {
      id: 'guest',
      displayName: GUEST_NAME,
      coins: 0,
      selectedCreatureId: 'bulbasaur',
      selectedFormId: 'bulbasaur',
      unlockedCreatureIds: [...starterIds],
      progress: Object.fromEntries(starterIds.map((id) => [id, { xp: 0, level: 1 }])),
    },
    runs: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Rebuilds a trustworthy guest state from whatever is in storage. Unknown
 * creatures, missing fields and malformed runs are dropped instead of crashing
 * the game, so a corrupt or outdated entry simply starts a fresh trail.
 */
export function normalizeGuestState(value: unknown): GuestState {
  if (!isRecord(value) || value.version !== GUEST_STATE_VERSION || !isRecord(value.profile)) {
    return createGuestState()
  }

  const stored = value.profile
  if (typeof stored.displayName !== 'string' || !isCount(stored.coins)) return createGuestState()

  const unlocked = Array.isArray(stored.unlockedCreatureIds)
    ? stored.unlockedCreatureIds.filter((id): id is string => typeof id === 'string' && catalogIds.has(id))
    : []
  for (const id of starterIds) if (!unlocked.includes(id)) unlocked.push(id)

  const progress: PlayerProfile['progress'] = {}
  if (isRecord(stored.progress)) {
    for (const [id, entry] of Object.entries(stored.progress)) {
      if (!catalogIds.has(id) || !isRecord(entry) || !isCount(entry.xp)) continue
      progress[id] = { xp: entry.xp, level: levelForXp(entry.xp) }
    }
  }
  for (const id of unlocked) progress[id] ??= { xp: 0, level: 1 }

  const creature = creatureCatalog.find((item) => item.id === stored.selectedCreatureId && unlocked.includes(item.id))
    ?? creatureCatalog.find((item) => unlocked.includes(item.id))
    ?? creatureCatalog[0]
  const form = creature.forms.find((item) => item.id === stored.selectedFormId)
    ?? creature.forms.find((item) => (progress[creature.id]?.level ?? 1) >= item.unlockLevel)
    ?? creature.forms[0]

  const runs = Array.isArray(value.runs)
    ? value.runs.filter((run): run is RunResult => (
      isRecord(run)
      && typeof run.id === 'string'
      && typeof run.creatureId === 'string'
      && typeof run.createdAt === 'string'
      && isCount(run.score)
      && isCount(run.durationMs)
      && isCount(run.collectedCoins)
      && isCount(run.coinsEarned)
      && isCount(run.xpEarned)
    )).slice(0, GUEST_RUN_LIMIT)
    : []

  return {
    version: GUEST_STATE_VERSION,
    profile: {
      id: 'guest',
      displayName: stored.displayName,
      coins: Math.floor(stored.coins),
      selectedCreatureId: creature.id,
      selectedFormId: form.id,
      unlockedCreatureIds: unlocked,
      progress,
    },
    runs,
  }
}

/** Mirrors `PostgresGameRepository.listCreatures` for the guest profile. */
export function guestCreatures(state: GuestState): Creature[] {
  const { profile } = state
  return creatureCatalog.map((creature) => {
    const unlocked = profile.unlockedCreatureIds.includes(creature.id)
    const level = profile.progress[creature.id]?.level ?? 0
    return {
      ...creature,
      unlocked,
      level,
      forms: creature.forms.map((form) => ({
        ...form,
        unlocked: unlocked && level >= form.unlockLevel,
      })),
    }
  })
}

export function guestSelect(state: GuestState, creatureId: string, formId: string): GuestState {
  const creature = creatureCatalog.find((item) => item.id === creatureId)
  const form = creature?.forms.find((item) => item.id === formId)
  if (!creature || !form) throw new Error('Creature or form is invalid')
  if (!state.profile.unlockedCreatureIds.includes(creatureId)) throw new Error('This creature is not unlocked')
  const level = state.profile.progress[creatureId]?.level ?? 0
  if (level < form.unlockLevel) throw new Error('This creature form has not been unlocked')

  return {
    ...state,
    profile: { ...state.profile, selectedCreatureId: creatureId, selectedFormId: formId },
  }
}

export function guestPurchase(state: GuestState, creatureId: string): GuestState {
  const creature = creatureCatalog.find((item) => item.id === creatureId)
  if (!creature || creature.starter || creature.price <= 0) {
    throw new Error('This creature is not available in the market')
  }
  if (state.profile.unlockedCreatureIds.includes(creatureId)) throw new Error('This creature is already unlocked')
  if (state.profile.coins < creature.price) throw new Error('Not enough sparks to unlock this creature')

  return {
    ...state,
    profile: {
      ...state.profile,
      coins: state.profile.coins - creature.price,
      unlockedCreatureIds: [...state.profile.unlockedCreatureIds, creatureId],
      progress: { ...state.profile.progress, [creatureId]: { xp: 0, level: 1 } },
    },
  }
}

export function guestRun(
  state: GuestState,
  input: SubmitRunRequest,
): { state: GuestState; run: RunResult } {
  if (!isValidRun(input.score, input.durationMs, input.collectedCoins)) {
    throw new Error('Run results exceed the allowed score or pickup limits')
  }
  if (!state.profile.unlockedCreatureIds.includes(input.creatureId)) {
    throw new Error('Runs require an unlocked creature')
  }

  const rewards = rewardsForRun(input.score, input.durationMs, input.collectedCoins)
  const xp = (state.profile.progress[input.creatureId]?.xp ?? 0) + rewards.xp
  const run: RunResult = {
    id: `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    score: input.score,
    durationMs: input.durationMs,
    collectedCoins: input.collectedCoins,
    coinsEarned: rewards.coins,
    xpEarned: rewards.xp,
    creatureId: input.creatureId,
    createdAt: new Date().toISOString(),
  }

  return {
    run,
    state: {
      ...state,
      profile: {
        ...state.profile,
        coins: state.profile.coins + rewards.coins,
        progress: {
          ...state.profile.progress,
          [input.creatureId]: { xp, level: levelForXp(xp) },
        },
      },
      runs: [run, ...state.runs].slice(0, GUEST_RUN_LIMIT),
    },
  }
}

/** A single personal best, matching the one row per player the API returns. */
export function guestLeaders(state: GuestState): LeaderboardEntry[] {
  const best = state.runs.reduce<RunResult | null>(
    (top, run) => (!top || run.score > top.score ? run : top),
    null,
  )
  if (!best) return []
  return [{
    rank: 1,
    player: state.profile.displayName,
    bestScore: best.score,
    creatureId: best.creatureId,
  }]
}
