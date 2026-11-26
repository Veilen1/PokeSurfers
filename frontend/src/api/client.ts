import type {
  AuthResponse,
  Credentials,
  CreaturesResponse,
  ErrorResponse,
  LeaderboardResponse,
  PlayerProfile,
  ProfileMutationResponse,
  RunResult,
  SubmitRunRequest,
  SubmitRunResponse,
} from '@trailkin/shared'
import type { ApiClient } from './types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')

class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  const payload: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const error = payload as ErrorResponse | undefined
    throw new ApiRequestError(
      error?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }
  return payload as T
}

function profileFrom(response: AuthResponse | ProfileMutationResponse): PlayerProfile {
  return response.profile
}

export const liveClient: ApiClient = {
  async getCurrentProfile() {
    try {
      return await request<PlayerProfile>('/auth/me')
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null
      throw error
    }
  },

  async listCreatures() {
    const response = await request<CreaturesResponse>('/creatures')
    return response.creatures
  },

  async getLeaderboard() {
    const response = await request<LeaderboardResponse>('/leaderboard')
    return response.leaders
  },

  async login(credentials) {
    return profileFrom(await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }))
  },

  async createAccount(credentials: Credentials) {
    return profileFrom(await request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }))
  },

  async logout() {
    await request<{ status: string }>('/auth/logout', { method: 'POST' })
  },

  async selectCreature(creatureId: string, formId: string) {
    return profileFrom(await request<ProfileMutationResponse>('/creatures/select', {
      method: 'POST',
      body: JSON.stringify({ creatureId, formId }),
    }))
  },

  async purchaseCreature(creatureId: string) {
    return profileFrom(await request<ProfileMutationResponse>('/market/purchase', {
      method: 'POST',
      body: JSON.stringify({ creatureId }),
    }))
  },

  async submitRun(run: SubmitRunRequest): Promise<{ run: RunResult; profile: PlayerProfile }> {
    return request<SubmitRunResponse>('/runs', {
      method: 'POST',
      body: JSON.stringify(run),
    })
  },
}
