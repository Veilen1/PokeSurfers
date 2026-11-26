export interface CityPerson {
  /** File name under frontend/public/game/people. */
  key: string
  /** Building facade the character stands next to. */
  building: string
  name: string
}

export interface CityWater {
  sides: 'left' | 'right' | 'both'
  /** Add wooden docks with fishermen, rods and bobbers. */
  fishing: boolean
}

/** Story characters and characteristic Pokémon placed next to their landmark. */
export const CITY_PEOPLE: Record<string, CityPerson[]> = {
  littleroot: [
    { key: 'prof_birch', building: 'oak-lab', name: 'Prof. Abedul' },
    { key: 'may', building: 'house-green-a', name: 'Aura' },
    { key: 'zigzagoon', building: 'sign', name: 'Zigzagoon' },
  ],
  petalburg: [
    { key: 'norman', building: 'pokemon-gym', name: 'Norman' },
    { key: 'wally', building: 'house-blue', name: 'Blasco' },
  ],
  rustboro: [
    { key: 'roxanne', building: 'pokemon-gym', name: 'Petra' },
    { key: 'devon_employee', building: 'devon-corp', name: 'Devon S.A.' },
    { key: 'maxie', building: 'devon-corp', name: 'Maxie' },
  ],
  dewford: [
    { key: 'brawly', building: 'pokemon-gym', name: 'Marcial' },
    { key: 'steven', building: 'sign', name: 'Máximo' },
  ],
  slateport: [
    { key: 'archie', building: 'museum', name: 'Archie' },
    { key: 'sailor', building: 'celadon-store', name: 'Marinero' },
    { key: 'wingull', building: 'museum', name: 'Wingull' },
  ],
  mauville: [
    { key: 'wattson', building: 'pokemon-gym', name: 'Erico' },
  ],
  lavaridge: [
    { key: 'flannery', building: 'pokemon-gym', name: 'Candela' },
    { key: 'hot_springs_old_woman', building: 'house-red', name: 'Aguas termales' },
  ],
  fortree: [
    { key: 'winona', building: 'pokemon-gym', name: 'Alana' },
    { key: 'kecleon', building: 'house-green-a', name: 'Kecleon' },
  ],
  lilycove: [
    { key: 'archie', building: 'contest-hall', name: 'Archie' },
    { key: 'wingull', building: 'department-store', name: 'Wingull' },
  ],
  mossdeep: [
    { key: 'tate', building: 'pokemon-gym', name: 'Vito' },
    { key: 'liza', building: 'pokemon-gym', name: 'Leti' },
    { key: 'steven', building: 'space-center', name: 'Máximo' },
  ],
  sootopolis: [
    { key: 'juan', building: 'pokemon-gym', name: 'Galano' },
    { key: 'wallace', building: 'museum', name: 'Plubio' },
    { key: 'azumarill', building: 'house-blue', name: 'Azumarill' },
  ],
  evergrande: [
    { key: 'sidney', building: 'museum', name: 'Sidney' },
    { key: 'phoebe', building: 'museum', name: 'Fátima' },
    { key: 'glacia', building: 'museum', name: 'Nívea' },
    { key: 'drake', building: 'museum', name: 'Dracón' },
    { key: 'wallace', building: 'celadon-store', name: 'Plubio' },
  ],
}

/** Coastal towns get water, and some of them fishermen and characteristic birds. */
export const CITY_WATER: Record<string, CityWater> = {
  dewford: { sides: 'both', fishing: true },
  slateport: { sides: 'both', fishing: true },
  lavaridge: { sides: 'left', fishing: false },
  lilycove: { sides: 'right', fishing: true },
  mossdeep: { sides: 'both', fishing: true },
  sootopolis: { sides: 'both', fishing: true },
  evergrande: { sides: 'right', fishing: true },
}
