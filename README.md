# PokeSurfers

PokeSurfers is a free-to-play fan-made browser game: a responsive three-lane endless runner with keyboard and swipe controls, player accounts, partner progression, earned-coin unlocks, public rankings, and long runnable platforms. It features six Pokémon partners whose animated walk-cycle sprites come from the community-run PMDCollab SpriteCollab library, credited in [Asset credits](#asset-credits). There are no microtransactions. Future funding may come only from optional donations made through an external link; donors receive no in-game currency, creatures, cosmetics, or other benefits.

## Local setup

Requirements: Node.js 24 or newer and npm.

```sh
npm install
docker compose up -d postgres
DATABASE_URL=postgresql://trailkin:trailkin@localhost:5433/trailkin npm run migrate --workspace=@trailkin/api
npm run build
npm run dev
```

On PowerShell, set the variable first:

```powershell
$env:DATABASE_URL = "postgresql://trailkin:trailkin@localhost:5433/trailkin"
npm run migrate --workspace=@trailkin/api
npm run dev
```

The React/Vite frontend prints its URL (normally `http://localhost:5173`); Fastify listens on `http://localhost:3000`. Local settings are documented in `.env.example`.

The database must run as a single container publishing `127.0.0.1:5433`. If an older compose file left a duplicate container, the API can end up talking to the wrong one or two Postgres processes can share the same data volume. Clean duplicates without touching the data:

```sh
docker compose down --remove-orphans
docker compose up -d
```

Do not run `docker compose down -v`: it deletes the `pokesurfers_trailkin-postgres` volume and every account. Never run two Postgres containers on the same volume.

On Windows PowerShell, if PostgreSQL's default port `5432` or the API port `3000` is already in use, use the project's alternate local ports:

```powershell
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://trailkin:trailkin@localhost:5433/trailkin"
npm run migrate --workspace=@trailkin/api
$env:PORT = "3001"
$env:API_PROXY_TARGET = "http://127.0.0.1:3001"
npm run dev
```

The Compose database binds only to `127.0.0.1:5433`; the frontend remains at `http://localhost:5173`.

## Guest mode and frontend-only deploys

The app probes `GET /api/health` when it starts. If a PokeSurfers API answers with its JSON health payload, accounts, server-side progression and the global leaderboard are enabled. Otherwise the game opens directly in **guest mode**: no login, no backend, and everything the player earns is saved in `localStorage`.

Guest mode keeps coins, XP and levels, unlocked partners, the selected form and the last 50 runs under `pokesurfers.guest.v1`. It uses the same catalog and reward rules as the API (both import them from the `shared` workspace), so progression feels identical.

Deploying only the frontend is supported:

```sh
npm run build
# serve frontend/dist from any static host at the domain root
```

Set `VITE_API_BASE_URL` only when an API exists. Static hosts that answer unknown paths with `index.html` are detected correctly (the health check requires JSON), so the game falls back to guest mode instead of hanging on the login screen. The header's **Connect account** button re-runs the check and switches to the normal login flow when a server appears; guest progress stays in the browser and is not transferred to the account. Clearing site data resets guest progress, and guest scores are not part of the global rankings.

### Vercel

The repository ships a `vercel.json`, so the project builds from the repository root:

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Keep **Root Directory** at the repository root. Do not pick `frontend`: the `shared` workspace and the root lockfile live outside it.
3. Leave the framework preset as detected (Other or Vite). The install, build and output settings come from `vercel.json`:
   - install: `npm ci`
   - build: `npm run build --workspace=frontend`
   - output: `frontend/dist`
4. Deploy. No environment variables are needed for guest mode.

`vercel.json` rewrites unknown paths to `index.html`, so `/market` or `/leaderboard` survive a reload, and caches `/assets` and `/game` separately. Vercel answers `/api/health` with the SPA page, so the game correctly boots as a guest. When an API is added later, set `VITE_API_BASE_URL` as a build-time variable in the Vercel project and add the Vercel domain to the API's `WEB_ORIGIN`.

Use Node 22.12 or newer (Node 24 also works). With the CLI: `npx vercel --prod`.

## Mobile

The layout is tuned for phones from 320 px up: the trail renders first, the hero and stat cards collapse away, the guest banner becomes a single strip, the start/pause card fits inside the canvas, and navigation, buttons and touch controls keep 44 px targets. The canvas switches to a taller 4:3 frame on phones so the road stays readable and swipes have more room before leaving the playfield.

On coarse pointers the 3D scene uses a lower quality tier: pixel ratio capped at 1.25×, no MSAA, smaller particle pools, a debounced resize, and rendering paused whenever a run is not active. Decorative CSS animations and hover-only effects are skipped, and the menu portraits repaint at the walk-cycle rate instead of every frame. Desktop keeps the original quality.

## Controls

- Use `←` / `→` or `A` / `D` to change lanes.
- Press `Space`, `↑`, or `W` to jump over logs and onto long platforms; press `↓` or `S` to slide under vines. Pressing down while airborne drops you faster.
- On touch screens, swipe sideways to change lanes, swipe up to jump, or swipe down to slide. On-screen jump and slide buttons are also available while running.

Each run starts on the meadow track and speeds up over time. Long platforms can be jumped on and run along, and the coins floating above them only count while you are on top. Hitting a platform side, a log, or a vine ends the run.

## Scoring and difficulty

The score follows the Subway Surfers model: points accumulate from the distance travelled and are multiplied by a run multiplier. The multiplier starts at ×1 and climbs by one every 200 m, up to ×10, so later metres are worth far more than early ones.

Difficulty ramps with distance too: speed climbs from 11 m/s up to 30 m/s, obstacle waves arrive more often, trains get longer (up to three times their starting length), and some trains carry ramps that launch you onto their roofs. From mid-run, tall stone towers appear; a normal jump from the track cannot reach them. Use an Ultra Ball (Super Sneakers), or jump from an adjacent lower platform to grab the tall roof. Roof coins and power-ups only count while you ride the platform. Hitting the front or side of a train, a log, or a vine ends the run.

Run rewards are derived from the final score (`score / 500` coins and `score / 250` XP, plus collected coins and time).

## Cities

The trail advances through Kanto as the score grows: **Pallet Town → Viridian City → Pewter City → Cerulean City → Vermilion City → Celadon City → Fuchsia City → Saffron City → Lavender Town → Cinnabar Island → Indigo Plateau**. Each city swaps the sky gradient, fog, grass path tint and the Pokémon Emerald building facades lining the track, and announces itself with a "Now entering" banner. Lavender Town drops into a twilight palette with Emerald Gastly and Haunter drifting over the meadow. Every city also applies its own facade tint and a lightweight ambient effect (pollen, leaves, dust, sparkles, sea mist, petals, fog, haze, snow, or the Emerald steam puffs on volcanic Cinnabar), so a city change is visible even before the banner fades. Thresholds and building sets live in `frontend/src/cities.ts`; the gaps grow larger as you progress.

The in-game HUD, pause card and end-of-run menu use a Pokémon Emerald menu frame crop, the HUD and city banners are drawn with the Pokémon Emerald bitmap font, and the power-up pickup burst overlays the game's stat-up chevrons directly on the runner's silhouette. The horizon uses pixel-art hills built from the Emerald grass tile with pixel-art clouds, and the ground rises into grassy banks toward both sides so the world reads as a valley instead of a flat wall. Dust trails, coin sparkles, power-up rings, crash shakes and flashes, city fades and high-speed streaks add the impact layer.

## Power-ups

Poké Balls spawn in safe lanes and on platform roofs. Touching one activates its effect and overlays the Pokémon Emerald stat-up chevrons directly on the runner's silhouette:

| Ball | Effect | Duration |
|---|---|---|
| Poké Ball | Draws nearby coins across lanes and from platform roofs toward the runner, then collects them | 8 s |
| Great Ball (Super Ball) | Doubles the score multiplier (the HUD badge turns green) | 10 s |
| Ultra Ball | Super Sneakers: jump 35 % higher | 10 s |
| Master Ball | Rides under your feet as a hoverboard and absorbs one crash; after saving you, grants 2 s of invulnerability | Until used |

## Sound

The game plays FireRed/LeafGreen sound effects for coins, jumping, landing, sliding, crashing, Poké Ball pickups, city transitions, menu clicks and the game-over jingle. The audio lives in `frontend/public/game/audio/`; regenerate it from the numbered rip with `npm run audio`. The mapping uses the song IDs in `include/constants/songs.h` from [pret/pokefirered](https://github.com/pret/pokefirered). The speaker button and volume slider below the track mute or mix the game and remember the choice locally.

## Checks

```sh
npm run build
npm test
npm test --workspace=frontend
```

Account passwords are stored as scrypt hashes. API sessions use short-lived signed tokens in HttpOnly cookies; there is no email address or password-recovery flow. Usernames are visible on the public leaderboard.

## Asset credits

Companion animations come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab), a community-run library of Pokémon Mystery Dungeon-style sprites; they are used under the PMDCollab license, which requires retaining credit to the original artists and forbids commercial use. Per-species artist credits are copied next to the frames in `frontend/public/game/sprites/<species>/credits.txt`. The walk sheets, `AnimData.xml` and credits needed to rebuild the current roster are vendored in `assets/Sprites-Walk/` (about 290 KB), so `npm run sprites` works from a clean clone; a full SpriteCollab checkout in `assets/Sprites/` is optional and gitignored.

The runner's building facades, vegetation, grass and dirt tiles, menu border, stat-effect chevrons and Lavender ghosts are cropped from Pokémon Emerald sheets hosted by [The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/): **Map Objects** by Lance, **Pokémon Centre & Mart** by Nintendofreak1O6, **Exterior Tileset** by Heartlessdragoon, **Littleroot Town** by Previous, **Stat Effects** by DecaTilde, **Pokémon (1st Generation, Normal)** by A.J. Nitro and **Pokémon Menu** by Previous. The intact Cut Tree and Rock Smash object frames come from [pret/pokeemerald](https://github.com/pret/pokeemerald/tree/master/graphics/object_events/pics/misc), with credit to the decompilation contributors and the original game artists. Recoloured house/civic variants are hue-shifted derivatives of Emerald sprites; the small route sign is a custom prop drawn in the Emerald palette. Individual sources and generation notes are listed in `assets/Sprites-Emerald/README.md`; `npm run assets:emerald` rebuilds the building set, props, tiles and menu/stat assets.

The four Poké Ball pickups come from the Pokémon Emerald [Poké Balls](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/20106/) sheet contributed by **wormintheworks**, and the HUD/city-banner font comes from the Pokémon Emerald [Font](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/8368/) sheet ripped by **Jackster**. The Potion, Running Shoes, King's Rock and Poké Ball interface icons come from the Emerald [Item Icons](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/26917/) sheet ripped by **Previous**, and Cinnabar's steam uses the Emerald [Steam Effects](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/155605/) sheet. All are listed in `assets/Sprites-Emerald/README.md`; `npm run font` regenerates the alpha atlas used by `PixelText`.

Sound effects come from the FireRed/LeafGreen [Sound Effects](https://sounds.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/397732/) rip uploaded by **iteachvader** on The Sounds Resource. The repository maps the numbered files to named effects with the song IDs from [pret/pokefirered](https://github.com/pret/pokefirered), and `npm run audio` trims and normalises the ten effects used by the game. See `assets/Sounds-FRLG/README.md`.

The partner form -> species mapping lives in `backend/src/catalog.ts` (forms) and `scripts/extract-sprites.mjs` (art). To add a companion or refresh its frames, place a SpriteCollab checkout at `assets/Sprites` and run:

```sh
node scripts/extract-sprites.mjs
```

The script slices the `Walk` animation into `front`, `back`, `left`, and `right` frames, regenerates `frontend/src/gameSpriteManifest.ts`, and leaves already-identical frames untouched.

Pokémon and Pokémon character designs are trademarks of Nintendo, Creatures Inc., and GAME FREAK inc. PokeSurfers is a non-commercial fan and portfolio project and is not affiliated with, sponsored by, or endorsed by them. Replace the sprite art with original artwork before any commercial distribution.

## Art and rights

Keep the brand, creature names, and world original. Record each future asset's source, creator, license, attribution, and permission evidence before adding it. Third-party artwork added for demonstration purposes must stay clearly attributed and non-commercial, or be replaced before distribution.

An external donation link does not by itself establish that an asset's use is noncommercial or grant rights to an underlying franchise. Review the exact asset license and underlying rights before changing the art policy.
