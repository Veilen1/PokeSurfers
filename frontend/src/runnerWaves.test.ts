import { describe, expect, it } from 'vitest'
import {
  OVERLOAD_GAP,
  WAVE_FRONT_Z,
  WAVE_GAP_METERS,
  planWave,
  type WaveObjectPlan,
  type WavePlan,
} from './runnerWaves'
import { speedAt } from './runnerMechanics'

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function planAt(distance: number, seed: number, lanes: number[] = [0, 1, 2]): WavePlan {
  return planWave(distance, lanes, seededRandom(seed))
}

function hazardsByRow(plan: WavePlan): Map<number, WaveObjectPlan[]> {
  const rows = new Map<number, WaveObjectPlan[]>()
  for (const object of plan.objects) {
    if (object.kind !== 'barrier' && object.kind !== 'branch') continue
    const row = rows.get(object.z) ?? []
    row.push(object)
    rows.set(object.z, row)
  }
  return rows
}

function isHazard(object: WaveObjectPlan): boolean {
  return object.kind === 'barrier' || object.kind === 'branch'
}

function frontEdge(object: WaveObjectPlan): number {
  return object.z + object.length / 2
}

describe('runner wave patterns', () => {
  it('always leaves a safe lane and uses only free lanes', () => {
    const distances = [0, 399, 400, 500, 900, 1200, 1500, 1999, 2000, 2500, 3000, 4000]
    for (const distance of distances) {
      for (let seed = 1; seed <= 120; seed += 1) {
        const plan = planAt(distance, seed)
        for (const row of hazardsByRow(plan).values()) {
          expect(row.length).toBeLessThanOrEqual(2)
        }
        for (const object of plan.objects) {
          expect([0, 1, 2]).toContain(object.lane)
          if (object.kind !== 'coin' && object.kind !== 'powerup') {
            expect(frontEdge(object)).toBeLessThanOrEqual(WAVE_FRONT_Z + 1e-6)
          }
        }
        if (plan.objects.length > 0) {
          expect(plan.delay * speedAt(distance)).toBeGreaterThanOrEqual(
            plan.depth + WAVE_GAP_METERS - 1e-6,
          )
        }
        const hazards = plan.objects.filter(isHazard)
        if (hazards.length > 0) {
          const farthestHazard = Math.min(...hazards.map((hazard) => hazard.z))
          expect(plan.depth).toBeCloseTo(Math.max(0, WAVE_FRONT_Z - farthestHazard), 5)
        }
        expect(plan.delay).toBeGreaterThanOrEqual(0.72)
      }
    }
  })

  it('validates free-lane subsets instead of forcing hazards next to a train wall', () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const twoLanes = planAt(1000, seed, [0, 1])
      expect(['double-barrier', 'double-branch', 'split', 'platform-hazard', 'overload'])
        .not.toContain(twoLanes.pattern)
      for (const row of hazardsByRow(twoLanes).values()) {
        expect(row.length).toBeLessThanOrEqual(1)
        for (const hazard of row) expect([0, 1]).toContain(hazard.lane)
      }

      const oneLane = planAt(1000, seed, [1])
      expect(oneLane.pattern).toBe('coins')
      for (const object of oneLane.objects) {
        expect(['coin', 'powerup']).toContain(object.kind)
        expect(object.lane).toBe(1)
      }

      const noLanes = planAt(1000, seed, [])
      expect(noLanes.pattern).toBe('coins')
      expect(noLanes.objects).toHaveLength(0)

      const nonAdjacent = planAt(1000, seed, [0, 2])
      expect(nonAdjacent.pattern).not.toBe('tall-tower')
      for (const row of hazardsByRow(nonAdjacent).values()) {
        expect(row.length).toBeLessThanOrEqual(1)
      }

      const rightPair = planAt(1000, seed, [1, 2])
      expect(['double-barrier', 'double-branch', 'split', 'platform-hazard', 'overload'])
        .not.toContain(rightPair.pattern)
      for (const row of hazardsByRow(rightPair).values()) {
        expect(row.length).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps pickups out of the hazard lanes in their own row', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = planAt(2600, seed)
      for (const object of plan.objects) {
        if (object.kind !== 'coin' && object.kind !== 'powerup') continue
        const row = plan.objects.filter((other) => (other.kind === 'barrier' || other.kind === 'branch')
          && Math.abs(other.z - object.z) < 0.01)
        expect(row.some((hazard) => hazard.lane === object.lane)).toBe(false)
      }
    }
  })

  it('keeps early waves simple and introduces tall towers later', () => {
    const early = new Set<string>()
    const middle = new Set<string>()
    for (let seed = 1; seed <= 200; seed += 1) {
      early.add(planAt(300, seed).pattern)
      middle.add(planAt(600, seed).pattern)
    }
    expect([...early]).not.toContain('tall-tower')
    expect([...early]).not.toContain('double-barrier')
    expect([...early]).not.toContain('overload')
    expect([...middle]).toContain('tall-tower')
  })

  it('adds the overload pattern only after 2,000 m', () => {
    const before = new Set<string>()
    const after = new Set<string>()
    for (let seed = 1; seed <= 300; seed += 1) {
      before.add(planAt(1999, seed).pattern)
      after.add(planAt(2500, seed).pattern)
    }
    expect([...before]).not.toContain('overload')
    expect([...after]).toContain('overload')
  })

  it('increases the number of obstacles after 2,000 m and then freezes the count', () => {
    const averageHazards = (distance: number): number => {
      let total = 0
      const seeds = 400
      for (let seed = 1; seed <= seeds; seed += 1) {
        total += planAt(distance, seed * 7919).objects.filter(isHazard).length
      }
      return total / seeds
    }

    const at1000 = averageHazards(1000)
    const at2500 = averageHazards(2500)
    const at3000 = averageHazards(3000)
    const at4000 = averageHazards(4000)
    expect(at2500).toBeGreaterThan(at1000 * 1.2)
    expect(Math.abs(at3000 - at4000)).toBeLessThan(0.25)
  })

  it('gives the overload pattern a one-lane safe path with enough room', () => {
    let found = 0
    for (let seed = 1; seed <= 400; seed += 1) {
      const plan = planAt(2600, seed)
      if (plan.pattern !== 'overload') continue
      found += 1
      const rows = [...hazardsByRow(plan).entries()].sort((a, b) => b[0] - a[0])
      expect(rows).toHaveLength(2)
      expect(rows[0][0] - rows[1][0]).toBeCloseTo(OVERLOAD_GAP, 5)
      for (const [, row] of rows) expect(row).toHaveLength(2)

      const safe1 = [0, 1, 2].find((lane) => !rows[0][1].some((hazard) => hazard.lane === lane))
      const safe2 = [0, 1, 2].find((lane) => !rows[1][1].some((hazard) => hazard.lane === lane))
      expect(safe1).toBeDefined()
      expect(safe2).toBeDefined()
      expect(Math.abs((safe1 as number) - (safe2 as number))).toBe(1)
      expect(plan.depth).toBe(OVERLOAD_GAP)
      expect(plan.delay * speedAt(2600)).toBeGreaterThanOrEqual(plan.depth + WAVE_GAP_METERS - 1e-6)
    }
    expect(found).toBeGreaterThan(0)
  })

  it('always pairs a tall tower with a reachable adjacent step and no hazards', () => {
    let found = 0
    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = planAt(700, seed)
      if (plan.pattern !== 'tall-tower') continue
      found += 1
      expect(plan.objects.some(isHazard)).toBe(false)
      const tall = plan.objects.find((object) => object.kind === 'platform' && object.height > 2)
      expect(tall).toBeDefined()
      const step = plan.objects.find((object) => object.kind === 'platform'
        && object.height < 2
        && Math.abs(object.lane - (tall as WaveObjectPlan).lane) === 1)
      expect(step).toBeDefined()
      expect(frontEdge(step as WaveObjectPlan)).toBeCloseTo(frontEdge(tall as WaveObjectPlan) + 20, 5)
    }
    expect(found).toBeGreaterThan(0)
  })

  it('keeps the velocity-only late game stable in obstacle count', () => {
    // From 3,000 m the weights are fixed; only speedAt keeps growing.
    expect(speedAt(3000)).toBeLessThan(speedAt(4000))
    expect(speedAt(4000)).toBe(38)
    expect(speedAt(10_000)).toBe(38)
  })
})
