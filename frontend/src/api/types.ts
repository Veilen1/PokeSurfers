import type {
  Credentials,
  Creature,
  LeaderboardEntry,
  PlayerProfile,
  RunResult,
  SubmitRunRequest,
} from '@trailkin/shared'

export interface ApiClient {
  getCurrentProfile(): Promise<PlayerProfile | null>
  listCreatures(): Promise<Creature[]>
  getLeaderboard(): Promise<LeaderboardEntry[]>
  login(credentials: Credentials): Promise<PlayerProfile>
  createAccount(credentials: Credentials): Promise<PlayerProfile>
  logout(): Promise<void>
  selectCreature(creatureId: string, formId: string): Promise<PlayerProfile>
  purchaseCreature(creatureId: string): Promise<PlayerProfile>
  submitRun(run: SubmitRunRequest): Promise<{ run: RunResult; profile: PlayerProfile }>
}
