# AGENTS.md — PokeSurfers

Juego fan-made de endless runner 3D en el navegador. Monorepo con frontend Vite,
API Fastify y un paquete compartido. El modo invitado es de primera clase: si la
API no responde, el juego debe seguir funcionando.

## Stack

- **Frontend:** React 19 + Vite 8 + Fluent UI + Three.js
- **Backend:** Fastify 5 + `pg` + Zod
- **Shared:** tipos, validaciones y catálogo (`shared/`)
- **DB:** PostgreSQL (Neon en producción)
- **Tests:** Vitest (backend)
- **Deploy:** Vercel (frontend) + Render o Vercel (backend)

## Comandos

```bash
npm run dev                          # API + web en paralelo
npm test                             # tests del backend
npm run build                        # shared + api + frontend
npm run lint --workspace=frontend    # oxlint
npm run migrate --workspace=@trailkin/api
```

## Arquitectura

```
frontend/   SPA (rutas propias, sin SSR)
backend/    API REST Fastify (/api/*)
shared/     contratos, validaciones y datos del juego
api/        proxy serverless del frontend (Vercel)
```

- El frontend consume **`/api`** (mismo origen). En dev, Vite lo proxya a
  `http://localhost:3000`; en producción lo resuelve `api/proxy.ts`.
- `detectBackend()` consulta `/api/health`. Si falla, se usa `guestClient` y el
  progreso queda en `localStorage`.
- La sesión es una cookie firmada (`trailkin_session`), `httpOnly`, `SameSite=None`
  y `Secure` en producción.
- Nunca llamar al backend directo desde el navegador en producción: rompe la
  sesión por cookies de tercera persona. Usar siempre `/api`.

## Deploy

Ver `docs/DEPLOY.md`. Resumen:

- **Frontend:** proyecto Vercel con Root Directory en la raíz. `api/proxy.ts`
  reenvía `/api/*` a `BACKEND_URL`.
- **Backend:** Render (recomendado, persistente) o un segundo proyecto Vercel
  (`backend/vercel.json` + `backend/api/index.js`).
- **No definir `VITE_API_BASE_URL` en producción.** El cliente debe usar `/api`.
- `BACKEND_URL` va sin `/api` al final.
- Migraciones contra la DB antes de probar login/leaderboard.

## React y performance

Usar la skill **`vercel-react-best-practices`** al tocar el frontend:

- Evitar waterfalls: `Promise.all` para fetches independientes.
- No bloquear el arranque por una llamada de red si se puede mostrar guest y
  actualizar después.
- Derivar estado en render, no en efectos.
- Memoizar solo trabajo costoso; no envolver primitivas.
- No definir componentes dentro de componentes.
- Listeners de scroll pasivos; limpiar efectos.

## Seguridad

- Contraseñas con `scrypt`; sesión firmada con HMAC.
- Validar input con Zod en el backend.
- No exponer `DATABASE_URL`, `SESSION_SECRET` ni cookies en logs.
- **Deuda:** no hay rate limiting en login/registro. Agregar antes de abrir el
  registro a tráfico real.
- Es un proyecto fan no comercial: no agregar monetización ni assets sin licencia.

## Calidad

Antes de cerrar un cambio:

1. `npm test` pasa.
2. `npm run build` pasa.
3. `npm run lint --workspace=frontend` pasa.
4. El modo invitado sigue funcionando sin backend.
5. Login y `/api/health` funcionan contra el backend local o deployado.

## No hacer

- No cambiar el flujo de assets/licencias de Pokémon.
- No convertir el juego en pago ni agregar microtransacciones.
- No hardcodear URLs del backend en el frontend; usar el proxy y `BACKEND_URL`.
- No tocar migraciones aplicadas sin crear una nueva.
