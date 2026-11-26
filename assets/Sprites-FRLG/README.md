# FireRed / LeafGreen sprite sources

Sheets downloaded from [The Spriters Resource — Pokémon FireRed / LeafGreen](https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/):

| File | Sheet | Credit |
|---|---|---|
| `buildings.png` | Buildings | ripped by Kermit Weiber (EternalDarkWing) |
| `menu-frames.png` | Menu Frames | ripped by EternalLight |
| `stat-effects.png` | Stat Effects | ripped by LDEJruff |
| `items.png` | Items | — |
| `ghost-and-fossils.png` | Ghost & Fossils | ripped by A.J. Nitro |
| `pokemon-battle.png` | Pokémon (battle sprites) | via The Spriters Resource |
| `tileset.png` | Tileset | ripped by Hosh (no credit required) |
| `tileset-bushes.png` | [Tileset (asset 3870)](https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3870/) | ripped by Hoopoe (no credit required) |

## Legacy reference

These sheets were used during the first art pass. The running game now uses the Emerald set in `assets/Sprites-Emerald/`; the FRLG rips are kept as reference, for the separate FireRed/LeafGreen sound-effect folder, and for the FireRed/LeafGreen roadside bushes.

- `node scripts/extract-frlg-buildings.mjs` slices `buildings.png` into `assets/Sprites-FRLG/buildings/` for reference only. It no longer writes to `frontend/public/game/buildings`, because that folder now holds the Emerald facades.
- `tileset-bushes.png` (asset 3870) supplies the round roadside bushes (`frontend/public/game/ui/bush.png`) distributed along both sides of the track.
- The runtime menu panel, stat chevrons, ghost sprites, vegetation, grass tile and horizon hills come from the Emerald sheets described in `assets/Sprites-Emerald/README.md`.
- The FireRed/LeafGreen sound effects used by the game live in `assets/Sounds-FRLG/` and are credited there.

## Rights

Pokémon and Pokémon character designs are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. These rips are used for a non-commercial fan/portfolio project only. Replace them with original artwork before any commercial distribution.
