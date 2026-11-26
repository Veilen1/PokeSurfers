import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { AppError } from './errors.js'

const scryptAsync = promisify(scrypt)
const COOKIE_NAME = 'trailkin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24
const ISSUER = 'trailkin-api'
const AUDIENCE = 'trailkin-web'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SessionClaims {
  sub: string
  iss: string
  aud: string
  iat: number
  exp: number
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | undefined
  }
}

export interface IAuthService {
  hashPassword(password: string): Promise<string>
  verifyPassword(password: string, storedHash: string): Promise<boolean>
  issueSession(userId: string, reply: FastifyReply): void
  revokeSession(reply: FastifyReply): void
  authenticate(request: FastifyRequest): string
}

export class AuthService implements IAuthService {
  constructor(
    private readonly secret: string,
    private readonly production: boolean,
  ) {}

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const key = await scryptAsync(password, salt, 64) as Buffer
    return `scrypt$${salt}$${key.toString('hex')}`
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, expectedHex] = storedHash.split('$')
    if (algorithm !== 'scrypt' || !salt || !expectedHex || password.length > 72) return false
    const expected = Buffer.from(expectedHex, 'hex')
    const actual = await scryptAsync(password, salt, expected.length) as Buffer
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }

  issueSession(userId: string, reply: FastifyReply): void {
    const now = Math.floor(Date.now() / 1_000)
    const claims: SessionClaims = {
      sub: userId,
      iss: ISSUER,
      aud: AUDIENCE,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    }
    const header = encode({ alg: 'HS256', typ: 'JWT' })
    const payload = encode(claims)
    const unsigned = `${header}.${payload}`
    const signature = this.sign(unsigned)
    reply.setCookie(COOKIE_NAME, `${unsigned}.${signature}`, {
      httpOnly: true,
      secure: this.production,
      sameSite: this.production ? 'none' : 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    })
  }

  revokeSession(reply: FastifyReply): void {
    reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.production,
      sameSite: this.production ? 'none' : 'lax',
      path: '/',
    })
  }

  authenticate(request: FastifyRequest): string {
    const token = request.cookies[COOKIE_NAME]
    if (!token) throw new AppError('UNAUTHORIZED', 'Authentication is required')
    const parts = token.split('.')
    if (parts.length !== 3) throw new AppError('UNAUTHORIZED', 'Session is invalid or expired')

    const [headerPart, payloadPart, signature] = parts
    const expected = this.sign(`${headerPart}.${payloadPart}`)
    const actualBytes = Buffer.from(signature)
    const expectedBytes = Buffer.from(expected)
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      throw new AppError('UNAUTHORIZED', 'Session is invalid or expired')
    }

    try {
      const header = decode(headerPart) as { alg?: unknown; typ?: unknown }
      const claims = decode(payloadPart) as Partial<SessionClaims>
      const now = Math.floor(Date.now() / 1_000)
      if (
        header.alg !== 'HS256'
        || header.typ !== 'JWT'
        || claims.iss !== ISSUER
        || claims.aud !== AUDIENCE
        || typeof claims.sub !== 'string'
        || !UUID_PATTERN.test(claims.sub)
        || typeof claims.exp !== 'number'
        || claims.exp <= now
        || typeof claims.iat !== 'number'
        || claims.iat > now + 60
      ) {
        throw new Error('Invalid claims')
      }
      return claims.sub
    } catch {
      throw new AppError('UNAUTHORIZED', 'Session is invalid or expired')
    }
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url')
  }
}

export function requireAuthentication(auth: IAuthService): preHandlerHookHandler {
  return async (request) => {
    request.userId = auth.authenticate(request)
  }
}

export function setAuthenticatedSession(
  auth: IAuthService,
  userId: string,
  reply: FastifyReply,
): void {
  auth.issueSession(userId, reply)
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decode(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
}
