export type RunnerAction = 'run' | 'jump' | 'slide'

export const PLAYER_Z = 2.3
export const PLAYER_HEIGHT = 2.4
export const PLATFORM_HEIGHT = 1.25
export const SLIDE_DURATION_SECONDS = 0.62
export const GRAVITY = 34
export const JUMP_VELOCITY = 14.8
export const FAST_FALL_VELOCITY = 22
export const SPEED_START = 11
export const SPEED_CAP = 30
export const SPEED_PER_METER = 0.018
export const MAX_MULTIPLIER = 10
export const METERS_PER_MULTIPLIER = 200
export const POINTS_PER_METER = 8
export const MOUNT_TOLERANCE = 0.55
export const TALL_PLATFORM_HEIGHT = 4

export interface PlayerState {
  lane: number
  /** Height of the runner's feet above the track. */
  y: number
  velocityY: number
  slideRemaining: number
  grounded: boolean
}

export interface PlatformLike {
  lane: number
  z: number
  length: number
  height: number
}

export interface StepResult {
  /** The runner ran into the side of a platform and could not climb it. */
  wallHit: boolean
  landed: boolean
}

export function createPlayerState(lane = 1): PlayerState {
  return { lane, y: 0, velocityY: 0, slideRemaining: 0, grounded: true }
}

/** Highest platform top underneath the runner, or 0 for the track. */
export function platformTopAt(platforms: readonly PlatformLike[], lane: number, z: number): number {
  let top = 0
  for (const platform of platforms) {
    if (platform.lane !== lane) continue
    if (z < platform.z - platform.length / 2 || z > platform.z + platform.length / 2) continue
    if (platform.height > top) top = platform.height
  }
  return top
}

export function jump(state: PlayerState, boost = 1): boolean {
  if (!state.grounded) return false
  state.velocityY = JUMP_VELOCITY * boost
  state.grounded = false
  state.slideRemaining = 0
  return true
}

/** Slides on the ground, or drops fast when already in the air. */
export function slide(state: PlayerState): boolean {
  if (!state.grounded) {
    state.velocityY = Math.min(state.velocityY, -FAST_FALL_VELOCITY)
    return false
  }
  state.slideRemaining = SLIDE_DURATION_SECONDS
  return true
}

export function stepPlayer(state: PlayerState, delta: number, platforms: readonly PlatformLike[]): StepResult {
  state.slideRemaining = Math.max(0, state.slideRemaining - delta)
  const support = platformTopAt(platforms, state.lane, PLAYER_Z)
  const gap = support - state.y

  // Ledge grab: if the runner is within reach of a roof (jumping from the
  // ground or from another platform), pull them onto it instead of dropping.
  if (gap > 0 && gap <= MOUNT_TOLERANCE) {
    state.y = support
    state.velocityY = 0
    state.grounded = true
    return { wallHit: false, landed: true }
  }

  if (state.grounded && gap > 0.45) {
    return { wallHit: true, landed: false }
  }

  if (!state.grounded || state.y > support + 0.001) {
    state.velocityY -= GRAVITY * delta
    state.y += state.velocityY * delta
    if (state.y <= support) {
      const landed = !state.grounded && state.velocityY < 0
      state.y = support
      state.velocityY = 0
      state.grounded = true
      return { wallHit: false, landed }
    }
    state.grounded = false
    return { wallHit: false, landed: false }
  }

  state.y = support
  state.velocityY = 0
  state.grounded = true
  return { wallHit: false, landed: false }
}

/** Logs are low enough to clear with a jump. */
export function clearsBarrier(state: PlayerState): boolean {
  return state.y >= 0.95
}

/** Vines and arches can only be passed while sliding. */
export function passesBranch(state: PlayerState): boolean {
  return state.slideRemaining > 0
}

/** Coins sit a little above the surface the runner is on. */
export function coinInReach(state: PlayerState, coinY: number): boolean {
  return Math.abs(state.y + 1 - coinY) <= 1.1
}

export function speedAt(distance: number): number {
  return Math.min(SPEED_START + distance * SPEED_PER_METER, SPEED_CAP)
}

/** Subway-style score multiplier: it climbs every few hundred metres. */
export function multiplierAt(distance: number): number {
  return Math.min(1 + Math.floor(distance / METERS_PER_MULTIPLIER), MAX_MULTIPLIER)
}
