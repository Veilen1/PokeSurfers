import { describe, expect, it } from 'vitest'
import {
  createGuestState,
  guestCreatures,
  guestLeaders,
  guestPurchase,
  guestRun,
  guestSelect,
  normalizeGuestState,
} from './progress'
import { createGuestStore, GUEST_STORAGE_KEY, type GuestStorage } from './store'

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  const storage: GuestStorage & { map: Map<string, string> } = {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
  }
  return storage
}

const runInput = { score: 1_000, durationMs: 30_000, collectedCoins: 10, creatureId: 'bulbasaur' }

describe('guest progression', () => {
  it('starts with the three starters and no coins', () => {
    const state = createGuestState()

    expect(state.profile.displayName).toBe('Guest')
    expect(state.profile.coins).toBe(0)
    expect(state.profile.unlockedCreatureIds).toEqual(['bulbasaur', 'charmander', 'squirtle'])
    expect(state.profile.progress.bulbasaur).toEqual({ xp: 0, level: 1 })
    expect(state.runs).toEqual([])
    expect(guestLeaders(state)).toEqual([])
  })

  it('applies the same rewards as the API', () => {
    const { state, run } = guestRun(createGuestState(), runInput)

    expect(run.coinsEarned).toBe(12)
    expect(run.xpEarned).toBe(19)
    expect(state.profile.coins).toBe(12)
    expect(state.profile.progress.bulbasaur).toEqual({ xp: 19, level: 1 })
    expect(state.runs[0]).toMatchObject({ score: 1_000, creatureId: 'bulbasaur' })
  })

  it('levels a partner and unlocks its evolution forms', () => {
    const state = createGuestState()
    state.profile.progress.bulbasaur = { xp: 399, level: 4 }
    const next = guestRun(state, { ...runInput, score: 0, collectedCoins: 0 }).state

    expect(next.profile.progress.bulbasaur).toEqual({ xp: 414, level: 5 })
    const forms = guestCreatures(next).find((creature) => creature.id === 'bulbasaur')!.forms
    expect(forms.find((form) => form.id === 'ivysaur')?.unlocked).toBe(true)
    expect(forms.find((form) => form.id === 'venusaur')?.unlocked).toBe(false)
  })

  it('only selects unlocked forms', () => {
    const state = createGuestState()

    expect(() => guestSelect(state, 'bulbasaur', 'ivysaur')).toThrow('not been unlocked')
    expect(() => guestSelect(state, 'starly', 'starly')).toThrow('not unlocked')
    expect(() => guestSelect(state, 'bulbasaur', 'nope')).toThrow('invalid')

    state.profile.progress.bulbasaur = { xp: 500, level: 6 }
    const next = guestSelect(state, 'bulbasaur', 'ivysaur')
    expect(next.profile.selectedCreatureId).toBe('bulbasaur')
    expect(next.profile.selectedFormId).toBe('ivysaur')
  })

  it('buys market partners with earned coins once', () => {
    const state = createGuestState()
    state.profile.coins = 35

    expect(guestPurchase(state, 'starly').profile.coins).toBe(0)
    expect(guestPurchase(state, 'starly').profile.unlockedCreatureIds).toContain('starly')
    expect(() => guestPurchase(state, 'starly')).not.toThrow()
    expect(() => guestPurchase(state, 'bulbasaur')).toThrow('market')
    expect(() => guestPurchase(createGuestState(), 'shroomish')).toThrow('Not enough')

    const bought = guestPurchase(state, 'starly')
    expect(() => guestPurchase(bought, 'starly')).toThrow('already unlocked')
    expect(bought.profile.progress.starly).toEqual({ xp: 0, level: 1 })
  })

  it('rejects impossible runs and locked partners', () => {
    expect(() => guestRun(createGuestState(), { ...runInput, score: 100_000, durationMs: 10_000 })).toThrow('exceed')
    expect(() => guestRun(createGuestState(), { ...runInput, durationMs: 500 })).toThrow('exceed')
    expect(() => guestRun(createGuestState(), { ...runInput, creatureId: 'starly' })).toThrow('unlocked creature')
  })

  it('keeps a personal best for the local rankings', () => {
    const first = guestRun(createGuestState(), runInput)
    const second = guestRun(first.state, { ...runInput, score: 4_000, collectedCoins: 8 })
    const leaders = guestLeaders(second.state)

    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toMatchObject({ rank: 1, player: 'Guest', bestScore: 4_000, creatureId: 'bulbasaur' })
  })

  it('repairs corrupt or outdated saved data', () => {
    expect(normalizeGuestState(null).profile.coins).toBe(0)
    expect(normalizeGuestState({ version: 99 }).profile.coins).toBe(0)

    const repaired = normalizeGuestState({
      version: 1,
      profile: {
        displayName: 'Guest',
        coins: 10.7,
        selectedCreatureId: 'missingno',
        selectedFormId: 'missingno',
        unlockedCreatureIds: ['bulbasaur', 'missingno'],
        progress: { bulbasaur: { xp: 450, level: 1 }, missingno: { xp: 9 } },
      },
      runs: [{ id: 'x', score: -5 }],
    })

    expect(repaired.profile.coins).toBe(10)
    expect(repaired.profile.unlockedCreatureIds).toEqual(['bulbasaur', 'charmander', 'squirtle'])
    expect(repaired.profile.progress.bulbasaur).toEqual({ xp: 450, level: 5 })
    expect(repaired.profile.progress.missingno).toBeUndefined()
    expect(repaired.profile.selectedCreatureId).toBe('bulbasaur')
    expect(repaired.profile.selectedFormId).toBe('bulbasaur')
    expect(repaired.runs).toEqual([])
  })
})

describe('guest storage', () => {
  it('round-trips progress through localStorage', () => {
    const storage = fakeStorage()
    const store = createGuestStore(storage)
    const state = guestRun(createGuestState(), runInput).state

    store.write(state)

    const reloaded = createGuestStore(storage).read()
    expect(reloaded.profile.coins).toBe(12)
    expect(reloaded.runs).toHaveLength(1)
    expect(JSON.parse(storage.map.get(GUEST_STORAGE_KEY)!).profile.coins).toBe(12)
  })

  it('starts fresh when the stored entry is corrupt or from another version', () => {
    expect(createGuestStore(fakeStorage({ [GUEST_STORAGE_KEY]: '{not json' })).read().profile.coins).toBe(0)
    expect(createGuestStore(fakeStorage({
      [GUEST_STORAGE_KEY]: JSON.stringify({ version: 99, profile: { coins: 9_999 } }),
    })).read().profile.coins).toBe(0)
  })

  it('keeps playing from memory when storage is unavailable', () => {
    const store = createGuestStore(null)
    const state = createGuestState()
    state.profile.coins = 42

    store.write(state)
    expect(store.read().profile.coins).toBe(42)

    const blocked: GuestStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('quota') },
    }
    const fallback = createGuestStore(blocked)
    expect(() => fallback.write(state)).not.toThrow()
    expect(fallback.read().profile.coins).toBe(42)
  })
})
