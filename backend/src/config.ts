export interface AppConfig {
  port: number
  databaseUrl: string
  sessionSecret: string
  nodeEnv: string
  webOrigin: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid TCP port')
  }

  const databaseUrl = env.DATABASE_URL
    ?? 'postgresql://trailkin:trailkin@localhost:5433/trailkin'
  try {
    const parsed = new URL(databaseUrl)
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error()
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  const nodeEnv = env.NODE_ENV ?? 'development'
  const sessionSecret = env.SESSION_SECRET
    ?? (nodeEnv === 'development' ? 'trailkin-local-development-secret-change-before-deploy' : '')
  if (Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes')
  }

  const webOrigin = env.WEB_ORIGIN ?? 'http://localhost:5173'
  try {
    const parsedOrigin = new URL(webOrigin)
    if (parsedOrigin.origin !== webOrigin || !['http:', 'https:'].includes(parsedOrigin.protocol)) {
      throw new Error()
    }
  } catch {
    throw new Error('WEB_ORIGIN must be a single HTTP(S) origin without a path')
  }
  if (nodeEnv === 'production' && !env.WEB_ORIGIN) {
    throw new Error('WEB_ORIGIN is required in production')
  }

  return { port, databaseUrl, sessionSecret, nodeEnv, webOrigin }
}
