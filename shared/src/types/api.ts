import type {
  Creature,
  LeaderboardEntry,
  PlayerProfile,
  RunResult,
} from './entities.js'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'

export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

export interface ProfileResponse extends PlayerProfile {}
export interface CreaturesResponse {
  creatures: Creature[]
}
export interface MarketResponse {
  offers: Creature[]
}
export interface SelectCreatureRequest {
  creatureId: string
  formId: string
}
export interface ProfileMutationResponse {
  profile: PlayerProfile
}
export interface PurchaseRequest {
  creatureId: string
}
export interface SubmitRunRequest {
  score: number
  durationMs: number
  collectedCoins: number
  creatureId: string
}
export interface SubmitRunResponse {
  run: RunResult
  profile: PlayerProfile
}
export interface LeaderboardResponse {
  leaders: LeaderboardEntry[]
}
export interface Credentials {
  username: string
  password: string
}
export interface AuthResponse {
  profile: PlayerProfile
}
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: Record<string, 'healthy' | 'unhealthy'>
}
