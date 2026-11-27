import {
  PLATFORM_HEIGHT,
  TALL_PLATFORM_HEIGHT,
  speedAt,
} from './runnerMechanics'
import type { PowerupKind, RunnerObjectKind } from './runnerScene'

export type WavePattern =
  | 'coins'
  | 'single-barrier'
  | 'single-branch'
  | 'double-barrier'
  | 'double-branch'
  | 'split'
  | 'low-platform'
  | 'twin-platforms'
  | 'tall-tower'
  | 'platform-hazard'
  | 'overload'

export interface WaveObjectPlan {
  lane: number
  z: number
  kind: RunnerObjectKind
  length: number
  height: number
  y: number
  ramp: boolean
  powerup?: PowerupKind
}

export interface WavePlan {
  pattern: WavePattern
  objects: WaveObjectPlan[]
  /** How far behind the first row the pattern extends, in metres. */
  depth: number
  /** Seconds until the next wave may spawn. */
  delay: number
}

type Random = () => number
type HazardKind = 'barrier' | 'branch'

const LANES = [0, 1, 2] as const
const HAZARD_Z = -54
const PLATFORM_FRONT_Z = -54
/** Tall towers start farther back so their step also starts at the wave front. */
const TALL_TOWER_FRONT_Z = -74
const TALL_STEP_FRONT_Z = -54
const COIN_Z = -58
const POWERUP_Z = -74
const COIN_SPACING = 3.1
const COIN_COUNT = 3

/** Closest z at which any wave object may appear. */
export const WAVE_FRONT_Z = HAZARD_Z

/** Distance between the two rows of an overload pattern. */
export const OVERLOAD_GAP = 30
/** Minimum distance between the last row of a wave and the next wave's first row. */
export const WAVE_GAP_METERS = 20

const DIFFICULTY_METERS = 1_500
const EARLY_DELAY = 1.8
const LATE_DELAY = 0.72
const DELAY_REDUCTION = 1.05
const DELAY_JITTER = 0.25

type WeightTable = Record<WavePattern, number>

const ZERO_WEIGHTS: WeightTable = {
  coins: 0,
  'single-barrier': 0,
  'single-branch': 0,
  'double-barrier': 0,
  'double-branch': 0,
  split: 0,
  'low-platform': 0,
  'twin-platforms': 0,
  'tall-tower': 0,
  'platform-hazard': 0,
  overload: 0,
}

function difficultyAt(distance: number): number {
  return Math.min(distance / DIFFICULTY_METERS, 1)
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.floor(random() * items.length)]
}

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function addCoins(objects: WaveObjectPlan[], lane: number, z: number, y = 1): void {
  for (let index = 0; index < COIN_COUNT; index += 1) {
    objects.push({
      lane,
      z: z + index * COIN_SPACING,
      kind: 'coin',
      length: 0,
      height: 0,
      y,
      ramp: false,
    })
  }
}

function addPowerup(
  objects: WaveObjectPlan[],
  lane: number,
  z: number,
  y: number,
  random: Random,
  chance: number,
): void {
  if (random() >= chance) return
  const roll = random()
  const powerup: PowerupKind = roll < 0.3 ? 'magnet' : roll < 0.6 ? 'double' : roll < 0.85 ? 'sneakers' : 'hoverboard'
  objects.push({ lane, z, kind: 'powerup', length: 0, height: 0, y, ramp: false, powerup })
}

function addHazard(objects: WaveObjectPlan[], lane: number, z: number, kind: HazardKind): void {
  objects.push({ lane, z, kind, length: 0, height: 0, y: 0, ramp: false })
}

function addLowPlatform(
  objects: WaveObjectPlan[],
  lane: number,
  distance: number,
  random: Random,
): void {
  const length = 13 + random() * 9 + difficultyAt(distance) * 26
  objects.push({
    lane,
    z: PLATFORM_FRONT_Z - length / 2,
    kind: 'platform',
    length,
    height: PLATFORM_HEIGHT,
    y: 0,
    ramp: random() < 0.5,
  })
  addCoins(objects, lane, PLATFORM_FRONT_Z - length + 3, PLATFORM_HEIGHT + 1)
  addPowerup(objects, lane, PLATFORM_FRONT_Z - 4, PLATFORM_HEIGHT + 1.2, random, 0.2)
}

function planCoins(lanes: readonly number[], random: Random): Omit<WavePlan, 'pattern' | 'delay'> {
  const objects: WaveObjectPlan[] = []
  const lane = pick(lanes, random)
  addCoins(objects, lane, COIN_Z)
  addPowerup(objects, lane, POWERUP_Z, 1.25, random, 0.12)
  return { objects, depth: 0 }
}

function planSingle(
  lanes: readonly number[],
  kind: HazardKind,
  random: Random,
): Omit<WavePlan, 'pattern' | 'delay'> {
  const lane = pick(lanes, random)
  const safeLane = pick(lanes.filter((candidate) => candidate !== lane), random)
  const objects: WaveObjectPlan[] = []
  addHazard(objects, lane, HAZARD_Z, kind)
  addCoins(objects, safeLane, COIN_Z)
  addPowerup(objects, safeLane, POWERUP_Z, 1.25, random, 0.14)
  return { objects, depth: 0 }
}

function planDouble(
  lanes: readonly number[],
  kind: HazardKind,
  random: Random,
): Omit<WavePlan, 'pattern' | 'delay'> {
  const order = shuffled(lanes, random)
  const safeLane = order[0]
  const objects: WaveObjectPlan[] = []
  for (const lane of order.slice(1)) addHazard(objects, lane, HAZARD_Z, kind)
  addCoins(objects, safeLane, COIN_Z)
  addPowerup(objects, safeLane, POWERUP_Z, 1.25, random, 0.14)
  return { objects, depth: 0 }
}

function planSplit(lanes: readonly number[], random: Random): Omit<WavePlan, 'pattern' | 'delay'> {
  const order = shuffled(lanes, random)
  const safeLane = order[0]
  const objects: WaveObjectPlan[] = []
  const kinds: HazardKind[] = random() < 0.5 ? ['barrier', 'branch'] : ['branch', 'barrier']
  addHazard(objects, order[1], HAZARD_Z, kinds[0])
  addHazard(objects, order[2], HAZARD_Z, kinds[1])
  addCoins(objects, safeLane, COIN_Z)
  addPowerup(objects, safeLane, POWERUP_Z, 1.25, random, 0.14)
  return { objects, depth: 0 }
}

function adjacentPairs(lanes: readonly number[]): [number, number][] {
  const pairs: [number, number][] = []
  for (const lane of lanes) {
    if (lanes.includes(lane + 1)) pairs.push([lane, lane + 1])
  }
  return pairs
}

function planTallTower(
  lanes: readonly number[],
  distance: number,
  random: Random,
): Omit<WavePlan, 'pattern' | 'delay'> | null {
  const pairs = adjacentPairs(lanes)
  if (pairs.length === 0) return null
  const pair = pick(pairs, random)
  const [first, second] = random() < 0.5 ? pair : [pair[1], pair[0]]
  const towerLane = first
  const stepLane = second
  const length = 13 + random() * 9 + difficultyAt(distance) * 26
  const objects: WaveObjectPlan[] = []

  objects.push({
    lane: towerLane,
    z: TALL_TOWER_FRONT_Z - length / 2,
    kind: 'platform',
    length,
    height: TALL_PLATFORM_HEIGHT,
    y: 0,
    ramp: false,
  })
  addCoins(objects, towerLane, TALL_TOWER_FRONT_Z - length + 3, TALL_PLATFORM_HEIGHT + 1)
  addPowerup(objects, towerLane, TALL_TOWER_FRONT_Z - 4, TALL_PLATFORM_HEIGHT + 1.2, random, 0.2)

  const stepLength = Math.max(26, length * 0.8)
  objects.push({
    lane: stepLane,
    z: TALL_STEP_FRONT_Z - stepLength / 2,
    kind: 'platform',
    length: stepLength,
    height: PLATFORM_HEIGHT,
    y: 0,
    ramp: false,
  })
  addCoins(objects, stepLane, TALL_STEP_FRONT_Z - stepLength + 3, PLATFORM_HEIGHT + 1)
  return { objects, depth: 0 }
}

function planPlatformHazard(
  lanes: readonly number[],
  distance: number,
  random: Random,
): Omit<WavePlan, 'pattern' | 'delay'> {
  const order = shuffled(lanes, random)
  const objects: WaveObjectPlan[] = []
  addLowPlatform(objects, order[0], distance, random)
  addHazard(objects, order[1], HAZARD_Z, random() < 0.5 ? 'barrier' : 'branch')
  addCoins(objects, order[2], COIN_Z)
  return { objects, depth: 0 }
}

function planOverload(lanes: readonly number[], random: Random): Omit<WavePlan, 'pattern' | 'delay'> {
  // Two rows. Row 1 is safe in `safe1`, row 2 in the adjacent `safe2`, so the
  // runner only needs one lane change between them.
  const pair = pick(adjacentPairs(lanes), random)
  const [safe1, safe2] = random() < 0.5 ? pair : [pair[1], pair[0]]
  const shared = lanes.find((lane) => lane !== safe1 && lane !== safe2)
  if (shared === undefined) return planCoins(lanes, random)

  const objects: WaveObjectPlan[] = []
  const rowOneKind: HazardKind = random() < 0.5 ? 'barrier' : 'branch'
  const rowTwoKind: HazardKind = random() < 0.5 ? 'barrier' : 'branch'

  addHazard(objects, shared, HAZARD_Z, rowOneKind)
  addHazard(objects, safe2, HAZARD_Z, rowOneKind)
  addCoins(objects, safe1, COIN_Z)

  const secondZ = HAZARD_Z - OVERLOAD_GAP
  addHazard(objects, shared, secondZ, rowTwoKind)
  addHazard(objects, safe1, secondZ, rowTwoKind)
  addCoins(objects, safe2, secondZ)
  addPowerup(objects, safe2, secondZ + 4, 1.25, random, 0.16)
  return { objects, depth: OVERLOAD_GAP }
}

function weightsFor(distance: number): WeightTable {
  const late = distance >= 2_000 ? Math.min(1, (distance - 2_000) / 1_000) : 0
  const overloadWeight = distance >= 2_000 ? 10 + late * 20 : 0

  if (distance < 400) {
    return {
      ...ZERO_WEIGHTS,
      coins: 16,
      'single-barrier': 32,
      'single-branch': 26,
      'low-platform': 26,
    }
  }
  if (distance < 900) {
    return {
      ...ZERO_WEIGHTS,
      coins: 10,
      'single-barrier': 18,
      'single-branch': 14,
      'double-barrier': 10,
      'double-branch': 6,
      'low-platform': 18,
      'twin-platforms': 6,
      'tall-tower': 12,
    }
  }
  if (distance < 1_500) {
    return {
      ...ZERO_WEIGHTS,
      coins: 7,
      'single-barrier': 12,
      'single-branch': 10,
      'double-barrier': 12,
      'double-branch': 8,
      split: 14,
      'low-platform': 12,
      'twin-platforms': 8,
      'tall-tower': 12,
      'platform-hazard': 8,
    }
  }
  if (distance < 2_000) {
    return {
      ...ZERO_WEIGHTS,
      coins: 5,
      'single-barrier': 8,
      'single-branch': 7,
      'double-barrier': 15,
      'double-branch': 11,
      split: 18,
      'low-platform': 10,
      'twin-platforms': 7,
      'tall-tower': 12,
      'platform-hazard': 10,
    }
  }
  return {
    ...ZERO_WEIGHTS,
    coins: 4,
    'single-barrier': 6,
    'single-branch': 5,
    'double-barrier': 17,
    'double-branch': 13,
    split: 20,
    'low-platform': 8,
    'twin-platforms': 6,
    'tall-tower': 10,
    'platform-hazard': 12,
    overload: overloadWeight,
  }
}

function patternAvailable(
  pattern: WavePattern,
  lanes: readonly number[],
  distance: number,
): boolean {
  const count = lanes.length
  switch (pattern) {
    case 'coins':
    case 'low-platform':
      return count >= 1
    case 'single-barrier':
    case 'single-branch':
    case 'twin-platforms':
      return count >= 2
    case 'tall-tower':
      return count >= 2 && adjacentPairs(lanes).length > 0
    case 'double-barrier':
    case 'double-branch':
    case 'split':
    case 'platform-hazard':
      return count >= 3
    case 'overload':
      return count >= 3 && distance >= 2_000
  }
}

function weightedPattern(distance: number, lanes: readonly number[], random: Random): WavePattern {
  const weights = weightsFor(distance)
  const entries = (Object.entries(weights) as [WavePattern, number][])
    .filter(([pattern, weight]) => weight > 0 && patternAvailable(pattern, lanes, distance))
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [pattern, weight] of entries) {
    roll -= weight
    if (roll <= 0) return pattern
  }
  return entries[entries.length - 1]?.[0] ?? 'coins'
}

function buildPattern(
  pattern: WavePattern,
  lanes: readonly number[],
  distance: number,
  random: Random,
): Omit<WavePlan, 'pattern' | 'delay'> | null {
  switch (pattern) {
    case 'coins':
      return planCoins(lanes, random)
    case 'single-barrier':
      return planSingle(lanes, 'barrier', random)
    case 'single-branch':
      return planSingle(lanes, 'branch', random)
    case 'double-barrier':
      return planDouble(lanes, 'barrier', random)
    case 'double-branch':
      return planDouble(lanes, 'branch', random)
    case 'split':
      return planSplit(lanes, random)
    case 'low-platform': {
      const lane = pick(lanes, random)
      const objects: WaveObjectPlan[] = []
      addLowPlatform(objects, lane, distance, random)
      return { objects, depth: 0 }
    }
    case 'twin-platforms': {
      const chosen = shuffled(lanes, random).slice(0, 2)
      const objects: WaveObjectPlan[] = []
      for (const lane of chosen) addLowPlatform(objects, lane, distance, random)
      return { objects, depth: 0 }
    }
    case 'tall-tower':
      return planTallTower(lanes, distance, random)
    case 'platform-hazard':
      return planPlatformHazard(lanes, distance, random)
    case 'overload':
      return planOverload(lanes, random)
  }
}

function baseDelay(distance: number, random: Random): number {
  const difficulty = difficultyAt(distance)
  return Math.max(LATE_DELAY, EARLY_DELAY - difficulty * DELAY_REDUCTION) + random() * DELAY_JITTER
}

/**
 * Chooses a fair wave for the current distance.
 *
 * `freeLanes` must contain only lanes without an approaching platform. Hazard
 * rows always leave at least one of those lanes clean, so a lane change is
 * always available; double-hazard patterns also require all three lanes to be
 * free, which means the runner is on the track and every safe lane is reachable.
 */
export function planWave(
  distance: number,
  freeLanes: readonly number[],
  random: Random = Math.random,
): WavePlan {
  const lanes = freeLanes.length > 0 ? [...freeLanes] : [...LANES]

  // All lanes have a platform approaching: take a breather instead of putting
  // coins or hazards inside a train. This keeps every pickup collectible.
  if (freeLanes.length === 0) {
    return { pattern: 'coins', objects: [], depth: 0, delay: baseDelay(distance, random) }
  }

  // While platforms are occupying two of the lanes, only add coins. This
  // avoids forcing a hazard into the one free lane next to a train wall.
  if (freeLanes.length < 2) {
    const planned = planCoins(lanes, random)
    return { pattern: 'coins', ...planned, delay: baseDelay(distance, random) }
  }

  const pattern = weightedPattern(distance, lanes, random)
  const planned = buildPattern(pattern, lanes, distance, random)
  if (!planned) {
    const fallback = planCoins(lanes, random)
    return { pattern: 'coins', ...fallback, delay: baseDelay(distance, random) }
  }

  const base = baseDelay(distance, random)
  const minDelay = (planned.depth + WAVE_GAP_METERS) / speedAt(distance)
  const delay = Math.max(base, minDelay)
  return { pattern, ...planned, delay }
}
