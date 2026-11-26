import { apiBaseUrl } from './client'

const DETECTION_TIMEOUT_MS = 2_500

/**
 * A deployed frontend may have no API behind it. The health endpoint is the
 * only reliable signal: static hosts often answer unknown paths with the SPA
 * HTML and a 200, so the response must also be JSON with a status and service
 * map. Anything else (404, HTML, timeout, offline) means guest mode.
 */
export async function detectBackend(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DETECTION_TIMEOUT_MS)
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!response.ok) return false
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) return false
    const payload: unknown = await response.json().catch(() => null)
    if (typeof payload !== 'object' || payload === null) return false
    const { status, services } = payload as { status?: unknown; services?: unknown }
    return typeof status === 'string' && typeof services === 'object' && services !== null
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
