import { describe, expect, it } from 'vitest'
import {
  GRAVITY,
  JUMP_VELOCITY,
  MAX_MULTIPLIER,
  METERS_PER_MULTIPLIER,
  MOUNT_TOLERANCE,
  PLATFORM_HEIGHT,
  SPEED_CAP,
  SPEED_START,
  TALL_PLATFORM_HEIGHT,
  clearsBarrier,
  coinInReach,
  createPlayerState,
  jump,
  laneChangeBlocked,
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
    const platformApex = PLATFORM_HEIGHT + normalApex

    // A normal ground jump must stay below the tower, even at its apex.
    expect(normalApex).toBeLessThan(TALL_PLATFORM_HEIGHT - MOUNT_TOLERANCE)
    // From the low platform, the same jump clears it with room to spare.
    expect(platformApex).toBeGreaterThan(TALL_PLATFORM_HEIGHT + 0.25)
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

  it('does not snap onto a tall roof from the side after a mid-air lane change', () => {
    const tall: PlatformLike = { lane: 1, z: 0, length: 20, height: TALL_PLATFORM_HEIGHT }
    const sideEntry = createPlayerState()
    sideEntry.y = 3
    sideEntry.velocityY = 0
    sideEntry.grounded = false

    const result = stepPlayer(sideEntry, 1 / 60, [tall])
    expect(result.wallHit).toBe(true)
    expect(sideEntry.y).toBeLessThan(TALL_PLATFORM_HEIGHT)
  })

  it('lands on a tall roof when falling onto it from above', () => {
    const tall: PlatformLike = { lane: 1, z: 0, length: 20, height: TALL_PLATFORM_HEIGHT }
    const falling = createPlayerState()
    falling.y = TALL_PLATFORM_HEIGHT + 0.3
    falling.velocityY = 0
    falling.grounded = false

    let landed = false
    for (let frame = 0; frame < 30; frame += 1) {
      landed = stepPlayer(falling, 1 / 60, [tall]).landed || landed
      if (landed) break
    }
    expect(landed).toBe(true)
    expect(falling.y).toBe(TALL_PLATFORM_HEIGHT)
    expect(falling.grounded).toBe(true)
  })

  it('blocks lane changes into a roof that is too high to mount', () => {
    const tall: PlatformLike = { lane: 1, z: 0, length: 20, height: TALL_PLATFORM_HEIGHT }
    const low: PlatformLike = { lane: 1, z: 0, length: 20, height: PLATFORM_HEIGHT }
    const state = createPlayerState(0)

    // Neither a tall tower nor a low platform can be entered from the ground.
    expect(laneChangeBlocked(state, [tall], 1)).toBe(true)
    expect(laneChangeBlocked(state, [low], 1)).toBe(true)

    // From the low platform the low roof is a normal step, the tall one is not.
    state.y = PLATFORM_HEIGHT
    expect(laneChangeBlocked(state, [low], 1)).toBe(false)
    expect(laneChangeBlocked(state, [tall], 1)).toBe(true)

    // Within the ledge-grab tolerance the tall roof can be entered.
    state.y = TALL_PLATFORM_HEIGHT - MOUNT_TOLERANCE
    expect(laneChangeBlocked(state, [tall], 1)).toBe(false)
    state.y = TALL_PLATFORM_HEIGHT - MOUNT_TOLERANCE - 0.01
    expect(laneChangeBlocked(state, [tall], 1)).toBe(true)

    // An empty lane is always available.
    expect(laneChangeBlocked(state, [], 1)).toBe(false)
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
