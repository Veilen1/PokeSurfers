# Project Plan

**Status**: Integrated
**Created**: 2026-11-03
**Mode**: NEW

---

## 1. Project Overview

**Goal**: Build PokeSurfers, an original, playable three-lane endless runner with keyboard and swipe controls, player accounts, persistent profiles and progression, unlockable creatures and forms, earned in-game coins, and a global leaderboard. The game is free to play with no microtransactions; any future support is limited to optional external donations with no in-game benefits. Design each module for independent testing.

**App Type**: SPA + API

**API Login**: Yes

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Backend — Fastify API

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Runtime** | Node |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test --workspace=@trailkin/api |
| **Orchestration** | docker-compose |

---

## 3. Frontend — Web App

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Framework** | React + Vite |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test --workspace=frontend |

---

## 4. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| Azure Static Web Apps | Host the React + Vite player interface | VITE_API_BASE_URL | `http://localhost:3000/api` | Essential |
| Azure App Service | Run the Node.js Fastify API | PORT | `3000` | Essential |
| Azure Database for PostgreSQL Flexible Server | Persist accounts, profiles, progression, coin balances, creature/form unlocks, and run scores | DATABASE_URL | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5433/trailkin` | Essential |

---

## 5. Prerequisites

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | * | ✅ | v24.18.0 |
| npm | * | ✅ | 12.0.1 |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Docker | backend | ✅ | 29.8.1 |
| Docker Compose | backend | ✅ | v5.5.1 |
| Chrome | frontend | ✅ | 156.0.8078.80 |

Docker CLI and Compose are installed; verify Docker Desktop's engine is running before starting the local PostgreSQL container.

---

## 6. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: A woodland-futurist arcade interface with deep forest surfaces, luminous trail-green actions, warm coin-gold highlights, and compact, legible HUD panels. Use rounded cards and restrained depth so the game action stays prominent without sacrificing clarity.
**Typography**: Inter, system-ui

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#5AD27D` | Trail-green primary actions, active navigation, and selected-creature indicators |
| `accent` | `#F5B85C` | Earned-coin rewards, high-score highlights, and boost accents |
| `surface` | `#0D1F22` | Deep forest page background and quiet game surfaces |
| `text` | `#EAFCF7` | High-contrast HUD values, headings, and body text |
| `muted` | `#A7C2BA` | Supporting labels, run metadata, and helper copy |
| `border` | `#2C4A4E` | Dividers and outlines separating dark cards and controls |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Game | `/` | Start or review a run, with current score, collected coins, and active runner status | `header + nav + hero + main + action-bar` |
| Creatures | `/creatures` | Review the owned roster, unlocked forms, and active loadout | `header + nav + main + tabs + card-list + actions` |
| Market | `/market` | Preview creatures and forms unlockable with earned coins | `header + nav + main + card-list + action-bar` |
| Rankings | `/leaderboard` | Review public global standings and best run scores | `header + nav + main + table` |

### Sample Content

`Game — run summaries:`
| Runner | Best Score | Best Chain | Status |
|--------|------------|------------|--------|
| Mossling | 18,400 | 14 | In run |
| Briarhorn | 12,900 | 9 | Unlocked |
| Solstice | 24,800 | 18 | Ready |

`Creatures — player roster:`
| Creature | Form | Level | Unlock Status |
|----------|------|-------|---------------|
| Mossling | Mossling | 1 | Active |
| Cinderkin | Flarelyn | 5 | Unlocked |
| Starling | Starling | 3 | Owned |

`Market — earned-coin unlocks (no microtransactions):`
| Creature | Price | Element | Unlock Condition |
|----------|-------|---------|------------------|
| Starling | 35 chispas | Astral | Available |
| Murmoss | 55 chispas | Grove | Available |
| Cloudlet | 80 chispas | Breeze | Progression |

`Rankings — global standings:`
| Rank | Player | Best Score | Creature |
|------|--------|------------|----------|
| 1 | pokesurfer_42 | 24,800 | Solstice |
| 2 | fernwhistle | 19,240 | Briarhorn |
| 3 | cinderstep | 17,980 | Mossling |

`Game — signed-in player: pokesurfer_42 · coins: 180 chispas · selected creature: Mossling`

---

## 7. Project Structure

```text
project-root/
├── .azure/
│   └── project-plan.md
├── package.json
├── .env.example
├── docker-compose.yml
├── packages/
│   └── shared/
│       ├── package.json
│       ├── src/
│       │   ├── entities.ts
│       │   ├── api.ts
│       │   └── schemas.ts
│       └── tests/
├── services/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── profile.ts
│   │   │   │   ├── creatures.ts
│   │   │   │   ├── market.ts
│   │   │   │   ├── runs.ts
│   │   │   │   └── leaderboard.ts
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   └── errors/
│   │   ├── migrations/
│   │   └── tests/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── GamePage.tsx
│       │   │   ├── CreaturesPage.tsx
│       │   │   ├── MarketPage.tsx
│       │   │   ├── LeaderboardPage.tsx
│       │   │   ├── LoginPage.tsx
│       │   │   ├── RegisterPage.tsx
│       │   │   └── AccountPage.tsx
│       │   ├── components/
│       │   ├── game/
│       │   ├── api/
│       │   └── tests/
│       └── public/
```

---

## 8. Route Definitions

All error responses use `{ "error": { "code": "…", "message": "…", "details": null } }`; validate request bodies and return consistent status codes.

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/api/health` | Report API and required-database health | — | `{ status, services }` | 200, 503 |
| 2 | POST | `/api/auth/register` | Create a username/password account | `{ username, password }` | `{ profile }` | 201, 409, 422 |
| 3 | POST | `/api/auth/login` | Sign in to an existing account | `{ username, password }` | `{ profile }` | 200, 401, 422 |
| 4 | POST | `/api/auth/logout` | End the current account session | — | `{ success }` | 200, 401 |
| 5 | GET | `/api/profile` | Return the current player's profile and progression | — | `{ id, username, coins, selectedCreatureId, unlockedCreatureIds, progress }` | 200, 401, 404 |
| 6 | GET | `/api/creatures` | Return creature catalog, forms, and the player's unlock state | — | `{ creatures }` | 200, 401 |
| 7 | POST | `/api/creatures/select` | Select an owned creature and unlocked form | `{ creatureId, formId }` | `{ profile }` | 200, 401, 422 |
| 8 | GET | `/api/market` | Return creatures available for earned-coin unlocks | — | `{ offers }` | 200, 401 |
| 9 | POST | `/api/market/purchase` | Unlock an eligible creature using earned coins | `{ creatureId }` | `{ profile }` | 200, 401, 409, 422 |
| 10 | POST | `/api/runs` | Validate a completed run, grant earned rewards, and update progression | `{ score, durationMs, collectedCoins, creatureId }` | `{ run, profile }` | 201, 401, 422 |
| 11 | GET | `/api/leaderboard` | Return public global best scores | `—` | `{ leaders }` | 200 |

---

## 9. Next Steps

1. Review and approve this plan in the plan preview.
2. Run **azure-project-scaffold** to create the frontend preview and scaffold the planned services.
3. Run **azure-project-integrate** to create database migrations, connect the frontend to live API data, and smoke-test the endpoints.
4. Run **azure-debug-plan** → **azure-debug-generate** for local database orchestration and VS Code debugging.
5. Run the **azure-deploy** agent when ready to deploy and verify the application in Azure.
