# PokeSurfers — Integration Handoff

## Backend
- Project: `backend/`
- Dev: `npm run dev --workspace=@trailkin/api`
- Build: `npm run build --workspace=@trailkin/api`
- Port: `3000` (`PORT`)
- Health: `GET /api/health`
- API: Fastify, PostgreSQL via `pg`; persistence boundary: `backend/src/repository.ts`
- Auth: HttpOnly signed session cookie; `SESSION_SECRET` (32+ bytes), `WEB_ORIGIN` required in production

## Frontend
- Project: `frontend/`
- Dev: `npm --prefix frontend run dev`
- Build: `npm --prefix frontend run build`
- API base: `VITE_API_BASE_URL`; live client defaults to `/api`
- Live-data seam: `frontend/src/api/index.ts` now exports `frontend/src/api/client.ts`; pages use shared API/entity contracts
- Scaffold mock client, duplicated frontend entity types, and preview-state switcher have been removed
- Vite development proxy defaults to the backend port (`3000`); `API_PROXY_TARGET` can override it locally
- Auth UI/state uses the live API seam and sends credentials for HttpOnly cookie sessions

## API route inventory
- `GET /api/health` — public
- `POST /api/auth/register` — create account; sets session cookie
- `POST /api/auth/login` — authenticate; sets session cookie
- `POST /api/auth/logout` — clear session cookie
- `GET /api/auth/me` — current authenticated profile
- `GET /api/profile` — authenticated profile
- `GET /api/creatures` — authenticated creature catalog and unlock/form state
- `POST /api/creatures/select` — authenticated `{ creatureId, formId }`
- `GET /api/market` — authenticated earned-coin creature offers
- `POST /api/market/purchase` — authenticated `{ creatureId }`, earned sparks only
- `POST /api/runs` — authenticated validated run submission
- `GET /api/leaderboard` — public rankings
- `GET /api/openapi.json` — API contract

## Database / migrations
- Type: PostgreSQL; connection: `DATABASE_URL`
- Local container: `docker-compose.yml`; default local database `trailkin`
- Migration tool/directory: `node-pg-migrate`, `backend/migrations/`; existing schema migration applied
- Expected tables: `accounts`, `profiles`, `unlocked_creatures`, `creature_progress`, `runs`
- Collection-to-table mapping: accounts → `accounts`; player profile and coins → `profiles`; creature ownership → `unlocked_creatures`; XP/levels → `creature_progress`; validated scores/rewards → `runs`
- Create schema migrations only; **NO seed data**
- Do not use the legacy ignored `backend/data/trailkin.sqlite`; the approved plan requires PostgreSQL

## Shared contracts and services
- Shared workspace: `@trailkin/shared` (`shared/src/types/`, `shared/src/schemas/`)
- Essential services: Azure Static Web Apps (frontend), Azure App Service (Fastify API), Azure Database for PostgreSQL
- Enhancement services: none

## Integration results — 2026-11-02
- Applied existing `1762100000000_create_trailkin_schema.js`; verified all five expected tables. No seed data or fixtures were created. Temporary end-to-end account and run were deleted after verification.
- Backend build passed; all 7 backend tests passed. Smoke-tested all 12 routes: public routes returned `200`, protected routes correctly returned `401` without a session, invalid registration returned `422`, and logout returned `200`.
- Frontend build passed; frontend test command passed (no frontend test files are defined). Replaced the mock client with a typed live API client, removed the duplicate type file and mock client, and confirmed no mock/preview-state references or `any` remain in `frontend/src`.
- End-to-end verification through the Vite `/api` proxy passed: health, registration/session, profile, creature catalog/selection, run submission/rewards, market purchase, leaderboard, and logout/cookie clearing. Frontend page returned `200`.
- For this machine, PostgreSQL and API used local ports `5433` and `3001` to avoid unrelated services already bound to `5432` and `3000`; the Vite proxy override was `API_PROXY_TARGET=http://127.0.0.1:3001`. No deployment was performed.

## Additional validation — 2026-11-03
- Added the approved `GET /api/market` offer-list route; it requires authentication and returns non-starter creatures. Added its shared response type, OpenAPI entry, and an auth/offer-filter test.
- `npm run build` passed; API tests passed (8 tests), frontend test command passed with no test files.
- Applied the schema migration to an isolated temporary PostgreSQL 17 container with no seed data, then verified all 13 API paths: health and leaderboard/OpenAPI returned `200`; protected routes rejected anonymous requests with `401`; invalid registration/login returned `422`; logout returned `200`. The temporary database/container was removed.
