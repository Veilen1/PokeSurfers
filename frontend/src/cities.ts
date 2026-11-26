export interface CityTheme {
  id: string
  name: string
  /** Score needed to reach this city. */
  threshold: number
  buildings: string[]
  skyTop: string
  skyBottom: string
  fog: string
  grassTint: string
  pathTint: string
  hills: [string, string, string]
  accent: string
}

export const CITY_THEMES: CityTheme[] = [
  {
    id: 'pallet',
    name: 'Pallet Town',
    threshold: 0,
    buildings: ['house-green-a', 'house-green-b', 'house-red', 'oak-lab', 'mailbox', 'sign'],
    skyTop: '#57c4ff',
    skyBottom: '#e8fbff',
    fog: '#c9f0ff',
    grassTint: '#ffffff',
    pathTint: '#ffffff',
    hills: ['#6cc25f', '#57a854', '#81cf6f'],
    accent: '#3f9b45',
  },
  {
    id: 'viridian',
    name: 'Viridian City',
    threshold: 6_000,
    buildings: ['house-green-a', 'house-red', 'pokemon-center', 'pokemart', 'pokemon-gym', 'sign'],
    skyTop: '#63c9ff',
    skyBottom: '#ecfbff',
    fog: '#cdf2ff',
    grassTint: '#f4fff1',
    pathTint: '#fffdf6',
    hills: ['#6bbd5d', '#559f51', '#7cc86b'],
    accent: '#3f9b45',
  },
  {
    id: 'pewter',
    name: 'Pewter City',
    threshold: 15_000,
    buildings: ['house-gray', 'house-yellow', 'pokemon-center', 'pokemart', 'museum', 'pokemon-gym'],
    skyTop: '#8dbde6',
    skyBottom: '#f1f6ff',
    fog: '#d7e6f5',
    grassTint: '#f1f7e8',
    pathTint: '#f5efe2',
    hills: ['#7f9d8b', '#6d8b7c', '#93b09b'],
    accent: '#7a6a4f',
  },
  {
    id: 'cerulean',
    name: 'Cerulean City',
    threshold: 27_000,
    buildings: ['house-blue', 'house-purple', 'pokemon-center', 'pokemart', 'pokemon-gym', 'bike-shop'],
    skyTop: '#4fb7ff',
    skyBottom: '#dff5ff',
    fog: '#c4ecff',
    grassTint: '#f0fbff',
    pathTint: '#fbfaf2',
    hills: ['#5da8d6', '#4c92c2', '#79bde2'],
    accent: '#2f7fb5',
  },
  {
    id: 'vermilion',
    name: 'Vermilion City',
    threshold: 42_000,
    buildings: ['house-yellow', 'house-red', 'pokemon-center', 'pokemart', 'fan-club', 'pokemon-gym'],
    skyTop: '#ffb673',
    skyBottom: '#fff0d6',
    fog: '#ffdcb5',
    grassTint: '#fff7e6',
    pathTint: '#fff8ea',
    hills: ['#c99a63', '#b98a58', '#d9ab74'],
    accent: '#d4713a',
  },
  {
    id: 'celadon',
    name: 'Celadon City',
    threshold: 60_000,
    buildings: ['celadon-store', 'celadon-mansion', 'game-corner', 'house-purple', 'house-lime', 'pokemon-center'],
    skyTop: '#ffc4e0',
    skyBottom: '#fff6fb',
    fog: '#ffd9ec',
    grassTint: '#fdf5ff',
    pathTint: '#fff3e8',
    hills: ['#c78bc2', '#b47cb2', '#d9a2d2'],
    accent: '#b64f9f',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia City',
    threshold: 81_000,
    buildings: ['house-green-a', 'house-lime', 'pokemon-center', 'pokemart', 'pokemon-gym', 'sign'],
    skyTop: '#ffbe86',
    skyBottom: '#fff3e2',
    fog: '#ffe1c2',
    grassTint: '#efffe8',
    pathTint: '#fff6e5',
    hills: ['#6fbf5f', '#8bcf63', '#5aa84f'],
    accent: '#c95f3f',
  },
  {
    id: 'saffron',
    name: 'Saffron City',
    threshold: 105_000,
    buildings: ['celadon-mansion', 'celadon-store', 'house-gray', 'house-blue', 'pokemon-center', 'fan-club'],
    skyTop: '#ffd27a',
    skyBottom: '#fff8e6',
    fog: '#ffe9bd',
    grassTint: '#f8fbe9',
    pathTint: '#fff9e9',
    hills: ['#b0a06a', '#998a58', '#c6b67c'],
    accent: '#b07a26',
  },
  {
    id: 'lavender',
    name: 'Lavender Town',
    threshold: 132_000,
    buildings: ['pokemon-tower', 'house-purple', 'house-gray', 'pokemon-center', 'sign'],
    skyTop: '#241d3d',
    skyBottom: '#4a3f66',
    fog: '#3a3155',
    grassTint: '#a79ec2',
    pathTint: '#b3a9c7',
    hills: ['#5b5278', '#4a4266', '#6d638c'],
    accent: '#6b5aa8',
  },
  {
    id: 'cinnabar',
    name: 'Cinnabar Island',
    threshold: 162_000,
    buildings: ['celadon-mansion', 'oak-lab', 'house-red', 'pokemon-center', 'pokemart'],
    skyTop: '#ff9a76',
    skyBottom: '#ffe9d6',
    fog: '#ffd0b5',
    grassTint: '#fff2e6',
    pathTint: '#fbeadb',
    hills: ['#b5715c', '#9f5f4c', '#c98a70'],
    accent: '#c4502f',
  },
  {
    id: 'indigo',
    name: 'Indigo Plateau',
    threshold: 195_000,
    buildings: ['celadon-store', 'museum', 'pokemon-center', 'house-blue', 'pokemon-gym'],
    skyTop: '#8f9bff',
    skyBottom: '#e9ecff',
    fog: '#c9d0ff',
    grassTint: '#f0f2ff',
    pathTint: '#f7f5ff',
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
