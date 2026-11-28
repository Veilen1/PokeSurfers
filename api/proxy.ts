import type { VercelRequest, VercelResponse } from "@vercel/node"

const BACKEND_URL = process.env.BACKEND_URL?.trim().replace(/\/+$/, "")

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
])

function buildTargetUrl(request: VercelRequest): URL | null {
  if (!BACKEND_URL) return null

  const { path: rawPath, ...query } = request.query
  const subPath = (Array.isArray(rawPath) ? rawPath.join("/") : rawPath ?? "")
    .replace(/^\/+/, "")

  const target = new URL(`${BACKEND_URL}/api/${subPath}`)
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) target.searchParams.append(key, entry)
    } else if (value !== undefined) {
      target.searchParams.set(key, String(value))
    }
  }
  return target
}

function forwardHeaders(request: VercelRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value))
  }
  return headers
}

function requestBody(request: VercelRequest): string | ArrayBuffer | undefined {
  if (request.method === "GET" || request.method === "HEAD") return undefined
  const body = request.body
  if (body === undefined || body === null) return undefined
  if (typeof body === "string") return body
  if (Buffer.isBuffer(body)) return new Uint8Array(body).buffer
  return JSON.stringify(body)
}

/**
 * Proxy same-origin para el API.
 *
 * El navegador habla con `<frontend>/api/*` (primera persona), y esta función
 * reenvía al backend real. Así no hay CORS ni cookies de tercera persona,
 * aunque el backend viva en otro dominio.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const target = buildTargetUrl(request)

  if (!target) {
    response.status(503).json({
      error: {
        code: "API_NOT_CONFIGURED",
        message: "The API backend is not configured",
      },
    })
    return
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: forwardHeaders(request),
      body: requestBody(request),
      redirect: "manual",
    })

    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower === "set-cookie" || HOP_BY_HOP_HEADERS.has(lower)) return
      response.setHeader(key, value)
    })

    const cookies = upstream.headers.getSetCookie?.()
      ?? (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")!] : [])
    if (cookies.length > 0) response.setHeader("set-cookie", cookies)

    const payload = Buffer.from(await upstream.arrayBuffer())
    response.status(upstream.status).send(payload)
  } catch {
    response.status(502).json({
      error: {
        code: "BAD_GATEWAY",
        message: "The API backend is unreachable",
      },
    })
  }
}
