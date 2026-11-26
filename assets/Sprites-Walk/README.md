# Walk-cycle sources

`npm run sprites` reads a full [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab)
checkout from `assets/Sprites`. That checkout is about 3 GB across 988 species and
227,000 files, so it is gitignored. This folder keeps only what the extractor
needs for the current roster: **three files per companion, 48 files, ~290 KB**.

## Contents

`sprite/<national dex id>/` mirrors the upstream layout:

- `Walk-Anim.png` — the eight-direction walk sheet; rows 0, 2, 4 and 6 become
  the `front`, `right`, `back` and `left` frames.
- `AnimData.xml` — frame size and duration count for the `Walk` animation.
- `credits.txt` — the artist credits that the PMDCollab license requires us to
  keep.

Nothing else from upstream is needed: attacks, sleep, fainting, portraits and
form-specific sheets are never drawn by the runner.

## How the extractor uses it

`scripts/extract-sprites.mjs` tries `assets/Sprites/sprite/<id>` first and falls
back to `assets/Sprites-Walk/sprite/<id>`. Both produce byte-identical frames,
which is checked by the script's `unchanged` counter.

To rebuild the runtime frames and `frontend/src/gameSpriteManifest.ts`:

```sh
npm run sprites
```

## Adding a companion

Add the same three files under `assets/Sprites-Walk/sprite/<id>/`, add the form
to the `companions` list and to `backend/src/catalog.ts`, then run
`npm run sprites`.

## License

The artwork remains the work of the SpriteCollab contributors, used under the
PMDCollab license: credit to the original artists must be retained and the work
may not be used commercially. Each species keeps its own `credits.txt` here and
next to the cropped frames in `frontend/public/game/sprites/`.

Pokémon and Pokémon character designs are trademarks of Nintendo, Creatures Inc.
and GAME FREAK inc. PokeSurfers is a non-commercial fan project.
