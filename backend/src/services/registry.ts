import { Pool } from 'pg'
import { AuthService, type IAuthService } from '../auth.js'
import { loadConfig, type AppConfig } from '../config.js'
import { PostgresGameRepository, type IGameRepository } from '../repository.js'

export interface AppServices {
  auth: IAuthService
  repository: IGameRepository
  webOrigin: string
  close: () => Promise<void>
}

let services: AppServices | null = null

export function initializeServices(config: AppConfig = loadConfig()): AppServices {
  if (services) return services
  const pool = new Pool({ connectionString: config.databaseUrl })
  services = {
    repository: new PostgresGameRepository(pool),
    auth: new AuthService(config.sessionSecret, config.nodeEnv === 'production'),
    webOrigin: config.webOrigin,
    close: () => pool.end(),
  }
  return services
}

export function registerServices(overrides: AppServices): void {
  services = overrides
}

export function getServices(config?: AppConfig): AppServices {
  return services ?? initializeServices(config)
}

export async function closeServices(): Promise<void> {
  const current = services
  services = null
  if (current) await current.close()
}
