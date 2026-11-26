import type { Creature } from './types/entities.js'

/**
 * The partner catalog shared by the API and the offline guest client, so both
 * offer the same creatures, prices and evolution levels.
 */
export const creatureCatalog: Omit<Creature, 'unlocked' | 'level'>[] = [
  {
    id: 'bulbasaur',
    name: 'Bulbasaur',
    element: 'Grass',
    motif: 'leaf',
    palette: { body: '#78c8a0', light: '#c8f2d8', dark: '#3c6b55' },
    starter: true,
    price: 0,
    forms: [
      { id: 'bulbasaur', name: 'Bulbasaur', unlockLevel: 1, unlocked: true },
      { id: 'ivysaur', name: 'Ivysaur', unlockLevel: 5, unlocked: false },
      { id: 'venusaur', name: 'Venusaur', unlockLevel: 10, unlocked: false },
    ],
  },
  {
    id: 'charmander',
    name: 'Charmander',
    element: 'Fire',
    motif: 'ember',
    palette: { body: '#f2915a', light: '#ffd7a3', dark: '#8a4426' },
    starter: true,
    price: 0,
    forms: [
      { id: 'charmander', name: 'Charmander', unlockLevel: 1, unlocked: true },
      { id: 'charmeleon', name: 'Charmeleon', unlockLevel: 5, unlocked: false },
      { id: 'charizard', name: 'Charizard', unlockLevel: 10, unlocked: false },
    ],
  },
  {
    id: 'squirtle',
    name: 'Squirtle',
    element: 'Water',
    motif: 'tide',
    palette: { body: '#77b7e8', light: '#cfeaff', dark: '#2f5f91' },
    starter: true,
    price: 0,
    forms: [
      { id: 'squirtle', name: 'Squirtle', unlockLevel: 1, unlocked: true },
      { id: 'wartortle', name: 'Wartortle', unlockLevel: 5, unlocked: false },
      { id: 'blastoise', name: 'Blastoise', unlockLevel: 10, unlocked: false },
    ],
  },
  {
    id: 'starly',
    name: 'Starly',
    element: 'Flying',
    motif: 'star',
    palette: { body: '#b9a88f', light: '#f1e8da', dark: '#5c5142' },
    starter: false,
    price: 35,
    forms: [
      { id: 'starly', name: 'Starly', unlockLevel: 1, unlocked: true },
      { id: 'staravia', name: 'Staravia', unlockLevel: 5, unlocked: false },
      { id: 'staraptor', name: 'Staraptor', unlockLevel: 10, unlocked: false },
    ],
  },
  {
    id: 'shroomish',
    name: 'Shroomish',
    element: 'Grass',
    motif: 'mushroom',
    palette: { body: '#d8c58a', light: '#f6edd0', dark: '#6f5f36' },
    starter: false,
    price: 55,
    forms: [
      { id: 'shroomish', name: 'Shroomish', unlockLevel: 1, unlocked: true },
      { id: 'breloom', name: 'Breloom', unlockLevel: 5, unlocked: false },
    ],
  },
  {
    id: 'swablu',
    name: 'Swablu',
    element: 'Flying',
    motif: 'cloud',
    palette: { body: '#8fc9ec', light: '#eaf8ff', dark: '#3c6c96' },
    starter: false,
    price: 80,
    forms: [
      { id: 'swablu', name: 'Swablu', unlockLevel: 1, unlocked: true },
      { id: 'altaria', name: 'Altaria', unlockLevel: 5, unlocked: false },
    ],
  },
]
