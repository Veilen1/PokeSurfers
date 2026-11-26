import { describe, expect, it } from 'vitest'
import { isValidRun, levelForXp, rewardsForRun } from './game.js'

describe('runner progression', () => {
  it('unlocks creature forms at the planned experience milestones', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(399)).toBe(4)
    expect(levelForXp(400)).toBe(5)
    expect(levelForXp(900)).toBe(10)
  })

  it('rejects impossible or malformed run results', () => {
    expect(isValidRun(300, 30_000, 4)).toBe(true)
    expect(isValidRun(600, 30_000, 40)).toBe(true)
    expect(isValidRun(20_000, 30_000, 40)).toBe(true)
    expect(isValidRun(100_000, 10_000, 4)).toBe(false)
    expect(isValidRun(100, 1_000, 500)).toBe(false)
    expect(isValidRun(-1, 10_000, 0)).toBe(false)
    expect(isValidRun(1.5, 10_000, 0)).toBe(false)
  })

  it('combines pickups, score, and elapsed time into rewards', () => {
    expect(rewardsForRun(300, 30_000, 4)).toEqual({ coins: 4, xp: 16 })
    expect(rewardsForRun(40_000, 60_000, 12)).toEqual({ coins: 92, xp: 190 })
  })
})
