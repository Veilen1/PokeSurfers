# Ruby / Sapphire building sprites

Source sheet: [Buildings (asset 8192)](https://www.spriters-resource.com/game_boy_advance/pokemonrubysapphire/asset/8192/)
by **Bacon** / ninsprites.tk. The sheet is kept as `buildings.png`.

Each facade is cropped to the largest connected component of its building and
flood-keyed from the sheet background (`224,224,224`) to transparency, so no
neighbouring buildings or grey box are included.

| File (`frontend/public/game/buildings/`) | Source region | In-game use |
|---|---|---|
| `pokemon-gym.png` (96×77) | Tan-roofed building with the red **GYM** sign | Gym facade in every gym city |
| `contest-hall.png` (79×79) | Yellow building with the large marquee | Ciudad Calagua (Concurso Pokémon) |
| `devon-corp.png` (96×78) | White/green corporate building with columns | Ciudad Férrica (Devon S.A.) |
| `space-center.png` (80×72) | Brown lattice-roof facility with orange door | Ciudad Algaria (Centro Espacial) |
| `department-store.png` (79×76) | Red building with the studded glass roof | Ciudad Calagua (Centro Comercial) |

Pokémon and Pokémon designs are trademarks of Nintendo, Creatures Inc. and
GAME FREAK inc. These sprites are used only for non-commercial fan/portfolio
work.
