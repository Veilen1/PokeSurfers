import { createServer } from "../dist/server.js"
import { getServices } from "../dist/services/registry.js"
import { loadConfig } from "../dist/config.js"

let appPromise

async function getApp() {
  if (!appPromise) {
    const config = loadConfig()
    appPromise = createServer(getServices(config)).catch((error) => {
      appPromise = undefined
      throw error
    })
  }
  const app = await appPromise
  await app.ready()
  return app
}

/**
 * Adaptador de Vercel para la API Fastify.
 *
 * `vercel.json` reescribe `/api/*` a `/api?path=*`; acá reconstruimos la URL
 * original para que Fastify encuentre sus rutas (`/api/auth/login`, etc.).
 */
export default async function handler(request, response) {
  const { path: rawPath, ...query } = request.query ?? {}
  const subPath = (Array.isArray(rawPath) ? rawPath.join("/") : rawPath ?? "")
    .replace(/^\/+/, "")

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry)
    } else if (value !== undefined) {
      search.set(key, String(value))
    }
  }

  request.url = `/api/${subPath}${search.size > 0 ? `?${search}` : ""}`

  const app = await getApp()
  app.server.emit("request", request, response)
}
