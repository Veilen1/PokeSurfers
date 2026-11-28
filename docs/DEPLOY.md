# Deploy de PokeSurfers

## Arquitectura

```
Navegador
  │  https://pokesurfers.vercel.app/api/*
  ▼
Vercel (frontend, Root Directory = raíz)
  │  rewrite /api/* → api/proxy.ts
  ▼
api/proxy.ts  (función serverless, mismo origen)
  │  fetch(BACKEND_URL + /api/*)
  ▼
Backend Fastify (Render o Vercel) ──► PostgreSQL (Neon)
```

El navegador **nunca** habla cross-origin con el backend: siempre usa `/api` en el
dominio del frontend. Eso evita CORS y, sobre todo, cookies de tercera persona
(Safari/ITP), que romperían la sesión si el frontend y el backend estuvieran en
dominios distintos.

## Variables

### Frontend (proyecto Vercel, raíz del repo)

| Variable | Valor | Notas |
| --- | --- | --- |
| `BACKEND_URL` | `https://pokesurfers-api.onrender.com` | Sin `/api` al final. La usa `api/proxy.ts`. |
| `VITE_API_BASE_URL` | **no definir** en producción | El cliente usa `/api` (mismo origen). |
| `VITE_DONATION_URL` | opcional | Solo HTTPS. |

Si `BACKEND_URL` no está definida, el proxy responde 503 y el juego arranca en
**modo invitado**; no se rompe la home.

### Backend

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Cadena **pooled** de Neon |
| `SESSION_SECRET` | 32+ bytes aleatorios |
| `WEB_ORIGIN` | `https://pokesurfers.vercel.app` |
| `PORT` | Lo provee el host |

`WEB_ORIGIN` solo se usa para CORS cuando alguien llama al backend directo. A
través del proxy no hace falta.

## Opción A (recomendada): backend en Render

Es la más simple para Fastify + `pg` + sesiones: servidor Node persistente, sin
adaptador serverless ni límites de función.

1. Crear una base **Neon Postgres** (región cerca del backend) y copiar la cadena
   *pooled*.
2. En Render: **New → Blueprint** y elegir este repo. Usa `render.yaml`.
3. Cargar `DATABASE_URL` (secreto) y dejar que Render genere `SESSION_SECRET`.
4. Verificar `WEB_ORIGIN=https://pokesurfers.vercel.app`.
5. Correr migraciones una vez (local o desde el shell de Render):

   ```bash
   DATABASE_URL="postgresql://..." npm run migrate --workspace=@trailkin/api
   ```

6. Probar `https://<servicio>.onrender.com/api/health` → `200` con
   `services.postgresql: healthy`.
7. En Vercel (frontend): definir `BACKEND_URL=https://<servicio>.onrender.com` y
   redeployar.

> El plan free de Render duerme el servicio. El primer request puede tardar ~30 s;
> el frontend cae en modo invitado y el botón **Connect account** reintenta.
> Para una demo siempre despierta, usar un plan pago o el backend en Vercel.

## Opción B: backend en Vercel (segundo proyecto)

El repo ya trae:

- `backend/api/index.js`: adaptador Fastify → handler de Vercel.
- `backend/vercel.json`: install/build y rewrite `/api/*` → `/api?path=*`.
- `backend/public/index.html`: landing mínima del servicio.

Pasos:

1. Crear un proyecto Vercel nuevo apuntando al mismo repo.
2. **Root Directory:** `backend`.
3. En Settings → Build & Development, habilitar
   **“Include source files outside of the Root Directory in the Build Step”**
   (necesario para `shared/` y el lockfile raíz).
4. Build command: `npm run build` (lo toma de `backend/vercel.json`).
5. Variables: `DATABASE_URL` (Neon pooled), `SESSION_SECRET`, `WEB_ORIGIN`,
   `NODE_ENV=production`.
6. Deploy. Probar `https://<proyecto>.vercel.app/api/health`.
7. En el frontend, `BACKEND_URL=https://<proyecto>.vercel.app` y redeploy.

> Caveats de Vercel Functions: cold starts, `maxDuration` de 10 s y un pool de
> `pg` por instancia. Con Neon (pooled) funciona, pero Render es más predecible
> para este backend.

## Verificación end-to-end

1. `GET https://pokesurfers.vercel.app/api/health` → JSON `200`.
2. En la app, el estado de conexión pasa a **online** (no invitado).
3. Registro/login: la cookie `trailkin_session` queda en el dominio del frontend.
4. Recargar: la sesión persiste.
5. `GET https://pokesurfers.vercel.app/api/leaderboard` → responde el backend.

## Troubleshooting

- **503 API_NOT_CONFIGURED**: falta `BACKEND_URL` en Vercel.
- **502 BAD_GATEWAY**: el backend no responde o la URL es incorrecta.
- **Siempre invitado**: el backend no está despierto o `/api/health` no devuelve
  JSON con `status` y `services`.
- **Login no persiste**: revisar que el navegador esté entrando por `/api` del
  frontend (no directo al backend) y que el proxy reenvíe `set-cookie`.
