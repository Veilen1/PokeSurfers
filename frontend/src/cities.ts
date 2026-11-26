export type CityAtmosphere =
  | 'pollen'
  | 'leaves'
  | 'dust'
  | 'sparkle'
  | 'mist'
  | 'steam'
  | 'petals'
  | 'fog'
  | 'haze'
  | 'snow'

export interface CityTheme {
  id: string
  name: string
  /** The landmark that identifies the town in the entrance banner. */
  landmark: string
  /** Score needed to reach this city. */
  threshold: number
  buildings: string[]
  skyTop: string
  skyBottom: string
  fog: string
  grassTint: string
  pathTint: string
  /** Multiplies the building sprites so each town has its own palette. */
  buildingTint: string
  /** Lightweight ambient effect that follows the player. */
  atmosphere: CityAtmosphere
  hills: [string, string, string]
  accent: string
}

/**
 * Hoenn in the order of the Emerald gym challenge, with the Latin American
 * Spanish location names and the structures each place is known for.
 */
export const CITY_THEMES: CityTheme[] = [
  {
    id: 'littleroot',
    name: 'Pueblo Escaso',
    landmark: 'Laboratorio del Prof. Abedul',
    threshold: 0,
    buildings: ['oak-lab', 'house-green-a', 'house-green-b', 'mailbox', 'sign'],
    skyTop: '#57c4ff',
    skyBottom: '#e8fbff',
    fog: '#c9f0ff',
    grassTint: '#ffffff',
    pathTint: '#ffffff',
    buildingTint: '#ffffff',
    atmosphere: 'pollen',
    hills: ['#6cc25f', '#57a854', '#81cf6f'],
    accent: '#3f9b45',
  },
  {
    id: 'petalburg',
    name: 'Ciudad Petalia',
    landmark: 'Gimnasio de Norman',
    threshold: 6_000,
    buildings: ['pokemon-gym', 'pokemon-center', 'pokemart', 'house-green-a', 'house-blue', 'sign'],
    skyTop: '#63c9ff',
    skyBottom: '#ecfbff',
    fog: '#cdf2ff',
    grassTint: '#f4fff1',
    pathTint: '#fffdf6',
    buildingTint: '#f2fff0',
    atmosphere: 'leaves',
    hills: ['#6bbd5d', '#559f51', '#7cc86b'],
    accent: '#3f9b45',
  },
  {
    id: 'rustboro',
    name: 'Ciudad Férrica',
    landmark: 'Gimnasio de Petra · Devon S.A.',
    threshold: 15_000,
    buildings: ['pokemon-gym', 'celadon-store', 'museum', 'pokemon-center', 'pokemart', 'house-yellow'],
    skyTop: '#8dbde6',
    skyBottom: '#f1f6ff',
    fog: '#d7e6f5',
    grassTint: '#f1f7e8',
    pathTint: '#f5efe2',
    buildingTint: '#f0e5d2',
    atmosphere: 'dust',
    hills: ['#7f9d8b', '#6d8b7c', '#93b09b'],
    accent: '#7a6a4f',
  },
  {
    id: 'dewford',
    name: 'Pueblo Azuliza',
    landmark: 'Gimnasio de Marcial · Máximo',
    threshold: 27_000,
    buildings: ['pokemon-gym', 'pokemon-center', 'pokemart', 'house-blue', 'house-purple', 'sign'],
    skyTop: '#4fb7ff',
    skyBottom: '#dff5ff',
    fog: '#c4ecff',
    grassTint: '#f0fbff',
    pathTint: '#fbfaf2',
    buildingTint: '#e6f6ff',
    atmosphere: 'mist',
    hills: ['#5da8d6', '#4c92c2', '#79bde2'],
    accent: '#2f7fb5',
  },
  {
    id: 'slateport',
    name: 'Ciudad Portual',
    landmark: 'Museo Oceánico · Archie',
    threshold: 42_000,
    buildings: ['celadon-store', 'museum', 'fan-club', 'pokemon-center', 'pokemart', 'house-red'],
    skyTop: '#ffb673',
    skyBottom: '#fff0d6',
    fog: '#ffdcb5',
    grassTint: '#fff7e6',
    pathTint: '#fff8ea',
    buildingTint: '#ffe9d2',
    atmosphere: 'sparkle',
    hills: ['#c99a63', '#b98a58', '#d9ab74'],
    accent: '#d4713a',
  },
  {
    id: 'mauville',
    name: 'Ciudad Malvalona',
    landmark: 'Gimnasio de Erico',
    threshold: 60_000,
    buildings: ['pokemon-gym', 'game-corner', 'bike-shop', 'celadon-store', 'pokemon-center', 'pokemart'],
    skyTop: '#ffd27a',
    skyBottom: '#fff8e6',
    fog: '#ffe9bd',
    grassTint: '#f8fbe9',
    pathTint: '#fff9e9',
    buildingTint: '#fff6dc',
    atmosphere: 'haze',
    hills: ['#b0a06a', '#998a58', '#c6b67c'],
    accent: '#b07a26',
  },
  {
    id: 'lavaridge',
    name: 'Pueblo Lavacalda',
    landmark: 'Aguas termales · Gimnasio de Candela',
    threshold: 81_000,
    buildings: ['pokemon-gym', 'pokemon-center', 'pokemart', 'house-red', 'house-yellow', 'sign'],
    skyTop: '#ff9a76',
    skyBottom: '#ffe9d6',
    fog: '#ffd0b5',
    grassTint: '#fff2e6',
    pathTint: '#fbeadb',
    buildingTint: '#ffe2d2',
    atmosphere: 'steam',
    hills: ['#b5715c', '#9f5f4c', '#c98a70'],
    accent: '#c4502f',
  },
  {
    id: 'fortree',
    name: 'Ciudad Arborada',
    landmark: 'Gimnasio de Alana',
    threshold: 105_000,
    buildings: ['pokemon-gym', 'pokemon-center', 'pokemart', 'house-green-a', 'house-green-b', 'house-lime'],
    skyTop: '#6fc9a8',
    skyBottom: '#e8fff4',
    fog: '#c9f2df',
    grassTint: '#effff4',
    pathTint: '#fffaf0',
    buildingTint: '#eafff0',
    atmosphere: 'leaves',
    hills: ['#4f9a63', '#3f7f54', '#69b477'],
    accent: '#3f7f54',
  },
  {
    id: 'lilycove',
    name: 'Ciudad Calagua',
    landmark: 'Centro Comercial · Guarida Aqua',
    threshold: 132_000,
    buildings: ['celadon-store', 'fan-club', 'celadon-mansion', 'pokemon-center', 'pokemart', 'house-purple'],
    skyTop: '#ffc4e0',
    skyBottom: '#fff6fb',
    fog: '#ffd9ec',
    grassTint: '#fdf5ff',
    pathTint: '#fff3e8',
    buildingTint: '#fff1fa',
    atmosphere: 'petals',
    hills: ['#c78bc2', '#b47cb2', '#d9a2d2'],
    accent: '#b64f9f',
  },
  {
    id: 'mossdeep',
    name: 'Ciudad Algaria',
    landmark: 'Gimnasio de Vito y Leti · Máximo',
    threshold: 162_000,
    buildings: ['pokemon-gym', 'museum', 'celadon-store', 'pokemon-center', 'pokemart'],
    skyTop: '#8f9bff',
    skyBottom: '#e9ecff',
    fog: '#c9d0ff',
    grassTint: '#f0f2ff',
    pathTint: '#f7f5ff',
    buildingTint: '#e6e9ff',
    atmosphere: 'sparkle',
    hills: ['#7f86c2', '#6c73ad', '#969dd4'],
    accent: '#4b55a8',
  },
  {
    id: 'sootopolis',
    name: 'Ciudad Arrecípolis',
    landmark: 'Gimnasio de Galano · Plubio',
    threshold: 195_000,
    buildings: ['pokemon-gym', 'celadon-mansion', 'house-blue', 'pokemon-center', 'pokemart', 'museum'],
    skyTop: '#a9d8ff',
    skyBottom: '#f2fbff',
    fog: '#d8f0ff',
    grassTint: '#f4ffff',
    pathTint: '#fffdf5',
    buildingTint: '#eef8ff',
    atmosphere: 'mist',
    hills: ['#7fb9d6', '#6aa6c7', '#9bcde4'],
    accent: '#3f7fa8',
  },
  {
    id: 'evergrande',
    name: 'Ciudad Colosalia',
    landmark: 'Liga Pokémon · Alto Mando',
    threshold: 235_000,
    buildings: ['museum', 'celadon-store', 'celadon-mansion', 'pokemon-center', 'sign'],
    skyTop: '#8f9bff',
    skyBottom: '#e9ecff',
    fog: '#c9d0ff',
    grassTint: '#f0f2ff',
    pathTint: '#f7f5ff',
    buildingTint: '#e6e9ff',
    atmosphere: 'petals',
    hills: ['#7f86c2', '#6c73ad', '#969dd4'],
    accent: '#4b55a8',
  },
]

export function cityAtScore(score: number): CityTheme {
  let current = CITY_THEMES[0]
  for (const city of CITY_THEMES) {
    if (score >= city.threshold) current = city
    else break
  }
  return current
}

export function nextCityFor(score: number): CityTheme | null {
  return CITY_THEMES.find((city) => city.threshold > score) ?? null
}
