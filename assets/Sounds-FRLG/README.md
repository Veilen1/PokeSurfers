# FireRed/LeafGreen sound effects

Source: [Sound Effects](https://sounds.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/397732/) on The Sounds Resource, ripped and uploaded by **iteachvader**. The ZIP contains 254 numbered WAVs (`firered_XXXX.wav`); `XXXX` is the hexadecimal song ID from `include/constants/songs.h` in [pret/pokefirered](https://github.com/pret/pokefirered).

`scripts/prepare-audio.mjs` copies the ten effects used by the runner into `frontend/public/game/audio/`, trims silence and normalises the peak:

| In-game sound | Source ID | FRLG constant |
|---|---|---|
| `coin.wav` | `firered_0015.wav` | `SE_PIN` |
| `jump.wav` | `firered_001C.wav` | `SE_BIKE_HOP` |
| `land.wav` | `firered_0031.wav` | `SE_BALL_BOUNCE_1` |
| `slide.wav` | `firered_0012.wav` | `SE_SLIDING_DOOR` |
| `crash.wav` | `firered_0007.wav` | `SE_WALL_HIT` |
| `powerup.wav` | `firered_000F.wav` | `SE_BALL_OPEN` |
| `city.wav` | `firered_0027.wav` | `SE_WARP_IN` |
| `gameover.wav` | `firered_0010.wav` | `SE_FAINT` |
| `click.wav` | `firered_001E.wav` | `SE_CLICK` |
| `select.wav` | `firered_0005.wav` | `SE_SELECT` |

Regenerate the web audio with:

```sh
npm run audio
```

The original WAVs are kept locally under `assets/Sounds-FRLG/` (not required at runtime). Pokémon and Pokémon sound effects are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. They are used here for a non-commercial fan/portfolio project and must not be redistributed commercially.
