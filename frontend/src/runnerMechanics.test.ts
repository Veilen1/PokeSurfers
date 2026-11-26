import { describe, expect, it } from 'vitest'
import {
  GRAVITY,
  JUMP_VELOCITY,
  MAX_MULTIPLIER,
  METERS_PER_MULTIPLIER,
  PLATFORM_HEIGHT,
  SPEED_CAP,
  SPEED_START,
  TALL_PLATFORM_HEIGHT,
  clearsBarrier,
  coinInReach,
  createPlayerState,
  jump,
  multiplierAt,
  passesBranch,
  platformTopAt,
  slide,
  speedAt,
  stepPlayer,
  type PlatformLike,
  type PlayerState,
} from './runnerMechanics'

const platform: PlatformLike = { lane: 1, z: 0, length: 20, height: PLATFORM_HEIGHT }

function runFrames(state: PlayerState, seconds: number, platforms: PlatformLike[] = []): void {
  const frames = Math.ceil(seconds * 60)
  for (let frame = 0; frame < frames; frame += 1) stepPlayer(state, 1 / 60, platforms)
}

describe('runner physics', () => {
  it('finds the platform surface under the runner only inside its footprint', () => {
    expect(platformTopAt([platform], 1, 2.3)).toBe(PLATFORM_HEIGHT)
    expect(platformTopAt([platform], 0, 2.3)).toBe(0)
    expect(platformTopAt([platform], 1, 14)).toBe(0)
  })

  it('jumps from the track and lands back on it', () => {
    const state = createPlayerState()

    expect(jump(state)).toBe(true)
    expect(state.velocityY).toBe(JUMP_VELOCITY)
    runFrames(state, 0.2)
    expect(state.y).toBeGreaterThan(0.5)
    runFrames(state, 1.2)
    expect(state.y).toBe(0)
    expect(state.grounded).toBe(true)
  })

  it('lands on a platform top instead of falling through it', () => {
    const state = createPlayerState()
    jump(state)

    for (let frame = 0; frame < 90 && !state.grounded; frame += 1) {
      stepPlayer(state, 1 / 60, [platform])
    }

    expect(state.grounded).toBe(true)
    expect(state.y).toBe(PLATFORM_HEIGHT)
  })

  it('walks off a platform and falls back to the track', () => {
    const state = createPlayerState()
    state.y = PLATFORM_HEIGHT
    state.grounded = true

    runFrames(state, 0.05, [platform])
    expect(state.y).toBe(PLATFORM_HEIGHT)

    runFrames(state, 1.2, [])
    expect(state.y).toBe(0)
    expect(state.grounded).toBe(true)
  })

  it('reports a wall hit when the runner meets a platform side', () => {
    const state = createPlayerState()
    state.lane = 1
    state.y = 0.2

    const result = stepPlayer(state, 1 / 60, [platform])

    expect(result.wallHit).toBe(true)
  })

  it('slides on the ground and fast-falls in the air', () => {
    const grounded = createPlayerState()
    expect(slide(grounded)).toBe(true)
    expect(passesBranch(grounded)).toBe(true)
    runFrames(grounded, 0.7)
    expect(passesBranch(grounded)).toBe(false)

    const airborne = createPlayerState()
    jump(airborne)
    expect(slide(airborne)).toBe(false)
    expect(airborne.velocityY).toBeLessThan(0)
  })

  it('scales speed and the score multiplier with distance', () => {
    expect(speedAt(0)).toBe(SPEED_START)
    expect(speedAt(50_000)).toBe(SPEED_CAP)
    expect(multiplierAt(0)).toBe(1)
    expect(multiplierAt(METERS_PER_MULTIPLIER - 1)).toBe(1)
    expect(multiplierAt(METERS_PER_MULTIPLIER)).toBe(2)
    expect(multiplierAt(METERS_PER_MULTIPLIER * 3)).toBe(4)
    expect(multiplierAt(1_000_000)).toBe(MAX_MULTIPLIER)
  })

  it('boosts the jump when super sneakers are active', () => {
    const normal = createPlayerState()
    jump(normal)
    const boosted = createPlayerState()
    jump(boosted, 1.35)

    expect(boosted.velocityY).toBeCloseTo(normal.velocityY * 1.35)
  })

  it('allows tall platforms only from a boosted or elevated jump', () => {
    const tall: PlatformLike = { lane: 1, z: 0, length: 20, height: TALL_PLATFORM_HEIGHT }
    const normalApex = (JUMP_VELOCITY ** 2) / (2 * GRAVITY)
    const boostedApex = ((JUMP_VELOCITY * 1.35) ** 2) / (2 * GRAVITY)

    expect(normalApex).toBeLessThan(TALL_PLATFORM_HEIGHT)
    expect(boostedApex).toBeGreaterThan(TALL_PLATFORM_HEIGHT)
    expect(PLATFORM_HEIGHT + normalApex).toBeGreaterThan(TALL_PLATFORM_HEIGHT)

    const high = createPlayerState()
    high.y = TALL_PLATFORM_HEIGHT - 0.3
    high.grounded = false
    const grabbed = stepPlayer(high, 1 / 60, [tall])
    expect(grabbed.wallHit).toBe(false)
    expect(high.y).toBe(TALL_PLATFORM_HEIGHT)

    const low = createPlayerState()
    expect(stepPlayer(low, 1 / 60, [tall]).wallHit).toBe(true)
  })

  it('only clears logs while above them and coins at the right height', () => {
    const state = createPlayerState()
    expect(clearsBarrier(state)).toBe(false)
    jump(state)
    runFrames(state, 0.3)
    expect(clearsBarrier(state)).toBe(true)

    expect(coinInReach(state, 1)).toBe(false)
    expect(coinInReach(createPlayerState(), 1)).toBe(true)

    const onPlatform = createPlayerState()
    onPlatform.y = PLATFORM_HEIGHT
    expect(coinInReach(onPlatform, PLATFORM_HEIGHT + 1)).toBe(true)
    expect(coinInReach(createPlayerState(), PLATFORM_HEIGHT + 1)).toBe(false)
    expect(GRAVITY).toBeGreaterThan(0)
  })
})
