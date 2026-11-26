import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectBackend } from './detect'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('backend detection', () => {
  it('accepts a healthy JSON health payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'healthy',
      services: { postgresql: 'healthy' },
    })))

    await expect(detectBackend()).resolves.toBe(true)
  })

  it('rejects a static host answering 200 with the SPA HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })))

    await expect(detectBackend()).resolves.toBe(false)
  })

  it('treats a 404 or an unhealthy service as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })))
    await expect(detectBackend()).resolves.toBe(false)

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'unhealthy',
      services: { postgresql: 'unhealthy' },
    }, { status: 503 })))
    await expect(detectBackend()).resolves.toBe(false)
  })

  it('treats network failures as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))

    await expect(detectBackend()).resolves.toBe(false)
  })
})
