export interface CreatureForm {
  id: string
  name: string
  unlockLevel: number
  unlocked: boolean
}

export interface Creature {
  id: string
  name: string
  element: string
  motif: string
  palette: {
    body: string
    light: string
    dark: string
  }
  starter: boolean
  price: number
  unlocked: boolean
  level: number
  forms: CreatureForm[]
}

export interface CreatureProgress {
  xp: number
  level: number
}

export interface PlayerProfile {
  id: string
  displayName: string
  coins: number
  selectedCreatureId: string
  selectedFormId: string
  unlockedCreatureIds: string[]
  progress: Record<string, CreatureProgress>
}

export interface RunResult {
  id: string
  score: number
  durationMs: number
  collectedCoins: number
  coinsEarned: number
  xpEarned: number
  creatureId: string
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  player: string
  bestScore: number
  creatureId: string
}
