# Pokémon Emerald assets

Source sheets from [The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/), used in this non-commercial fan/portfolio project with credit.

| File | Source asset | Credit | Used for |
|---|---|---|---|
| `map-objects.png` | [Map Objects](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/8362/) | **Lance** | Clean house/lab facades and complete decorative trees |
| `pokemon-center-mart.png` | [Pokémon Centre & Mart](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/38099/) | **Nintendofreak1O6** | Complete Pokémon Center and Mart icons used on the track |
| `exterior-tileset.png` | [Exterior Tileset](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/61816/) | **Heartlessdragoon** | Rock Smash boulder obstacle (`obstacle-rock`) and dirt path tile (`tile-path`) |
| `littleroot-town.png` | [Littleroot Town](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/19776/) | **Previous** | Grass tile (`tile-grass`), flowers and mailbox |
| `stat-effects.png` | [Stat Effects](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/19782/) | **DecaTilde** | Attack / Defense / Speed / Accuracy chevrons (`stat-arrow-*`) |
| `pokemon-gen1.png` | [Pokémon (1st Generation, Normal)](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/21230/) | **A.J. Nitro** | Gastly and Haunter in Lavender Town (`ghost-*`) |
| `pokemon-menu.png` | [Pokémon Menu](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/26964/) | **Previous** | Menu border (`panel-emerald`) for the pause/end cards |
| `object-cuttable-tree.png`, `object-breakable-rock.png` | [pret/pokeemerald event-object sprites](https://github.com/pret/pokeemerald/tree/master/graphics/object_events/pics/misc) | **pret/pokeemerald contributors**; original game art by Game Freak/Nintendo | Intact Emerald Cut tree and Rock Smash obstacle frames |
| `poke-balls.png` | [Poké Balls](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/20106/) | **wormintheworks** | Poké Ball, Great Ball, Ultra Ball and Master Ball pickups |
| `item-icons.png` | [Item Icons](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/26917/) | **Previous** | Potion, Running Shoes and Pokémon Ball icons for the navigation, page headers and the favicon |
| `steam-effects.png` | [Steam Effects](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/155605/) | **The Spriters Resource community** | Pueblo Lavacalda hot-spring steam puffs (`fx-steam`) |
| `font.gif` | [Font](https://www.spriters-resource.com/game_boy_advance/pokemonemerald/asset/8368/) | **Jackster** | HUD, city banners and menu headings (`font-emerald` atlas) |

## Generated files

- `frontend/public/game/buildings/*.png` — 21 facades and small props (houses, Pokémon Center, Mart, lab, sign, mailbox). The green/blue/lime/gray/yellow houses are hue-shifted derivatives of the Map Objects red house; the store/mansion/gym/game-corner/tower variants are tinted versions of the lab or Mart; the Center and Mart use the dedicated complete icons; the small route sign is a custom prop drawn in the Emerald palette.
- `frontend/public/game/ui/veg-*.png`, `tile-grass.png`, `tile-path.png` — complete decorative trees/flowers and route tiles.
- `frontend/public/game/ui/obstacle-tree.png` and `obstacle-rock.png` — the intact first 16×16 event frame from the Emerald Cut Tree and Breakable Rock sheets. They alternate as the small jumpable obstacles. These are not crops of decorative trees or ground tiles; the old clipped `veg-bush.png` obstacle is removed by the generator.
- `frontend/public/game/ui/stat-arrow-*.png`, `ghost-*.png`, `panel-emerald.png` — Emerald battle/UI art.
- `frontend/public/game/ui/ball-*.png` — the four 12×12 ball crops.
- `frontend/public/game/ui/icon-pokeball.png`, `icon-potion.png`, `icon-shoes.png` — 24×24 item icons cut from the Item Icons sheet: navigation tabs, page headers and the favicon. `icon-kings-rock.png` is the 32×32 PokéSprite sprite described in `assets/Sprites-UI/README.md`.
- `frontend/public/game/ui/fx-steam.png` — the steam puff from the Steam Effects sheet, used by Pueblo Lavacalda's hot-spring weather.
- `frontend/public/game/people/*.png` — front-facing character and Pokémon billboards placed next to their landmark; sources and credits in `assets/Sprites-Emerald/people-source/README.md`.
- `frontend/public/game/ui/font-emerald.png` + `frontend/src/pixelFontData.ts` — the bitmap font atlas and metrics.

`interface.png` (Battle Frontier UI) is a reference sheet kept for future UI work; the runner does not use it yet.

## Regenerating

```sh
npm run assets:emerald   # balls, buildings, vegetation, tiles, stat effects, ghosts, panel, font
npm run audio            # FRLG sound effects (see assets/Sounds-FRLG)
```

The PowerShell scripts are Windows-friendly (System.Drawing) and use the original sheets in this folder. They key the sheet backgrounds to transparency, trim the sprites and write both the archived source crops under `assets/Sprites-Emerald/buildings` / `ui` and the runtime files under `frontend/public`.

Pokémon and Pokémon character designs are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. These rips are not affiliated with or endorsed by them and must not be used for commercial distribution.
