# Partner sprite frames

These folders hold the walk-cycle frames the game loads at runtime. Each species folder contains:

- `front/` – facing the camera (portraits and menus)
- `back/` – facing away from the camera (the default runner view)
- `left/` and `right/` – profile views used while changing lanes
- `credits.txt` – artist credits for that species

## Source and license

The frames are cropped from the `Walk` animations in [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab). They are used under the PMDCollab license: credit to the original artists must be retained and the work may not be used commercially.

Pokémon and Pokémon character designs are trademarks of Nintendo, Creatures Inc., and GAME FREAK inc. PokeSurfers is a non-commercial fan and portfolio project and is not affiliated with, sponsored by, or endorsed by them.

## Regenerating

The committed PNGs are generated, not hand-edited. With a SpriteCollab checkout at `assets/Sprites`:

```sh
node scripts/extract-sprites.mjs
```

The script also regenerates `frontend/src/gameSpriteManifest.ts`, which maps each partner form to its folder and frame counts.