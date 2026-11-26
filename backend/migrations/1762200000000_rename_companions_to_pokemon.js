const creatureRenames = [
  ['mossling', 'bulbasaur'],
  ['cinderkin', 'charmander'],
  ['rillbit', 'squirtle'],
  ['starling', 'starly'],
  ['murmoss', 'shroomish'],
  ['cloudlet', 'swablu'],
]

const formRenames = [
  ['mossling', 'bulbasaur'],
  ['briarhorn', 'ivysaur'],
  ['canopyx', 'venusaur'],
  ['cinderkin', 'charmander'],
  ['flarelyn', 'charmeleon'],
  ['solstice', 'charizard'],
  ['rillbit', 'squirtle'],
  ['reefawn', 'wartortle'],
  ['tidehart', 'blastoise'],
  ['starling', 'starly'],
  ['murmoss', 'shroomish'],
  ['cloudlet', 'swablu'],
]

async function renameCreature(pgm, from, to) {
  await pgm.sql(`
    INSERT INTO unlocked_creatures (user_id, creature_id, unlocked_at)
    SELECT user_id, '${to}', unlocked_at FROM unlocked_creatures WHERE creature_id = '${from}'
    ON CONFLICT (user_id, creature_id) DO NOTHING;

    DELETE FROM unlocked_creatures WHERE creature_id = '${from}';

    INSERT INTO creature_progress (user_id, creature_id, xp, updated_at)
    SELECT user_id, '${to}', xp, updated_at FROM creature_progress WHERE creature_id = '${from}'
    ON CONFLICT (user_id, creature_id)
    DO UPDATE SET xp = GREATEST(creature_progress.xp, EXCLUDED.xp);

    DELETE FROM creature_progress WHERE creature_id = '${from}';

    UPDATE runs SET creature_id = '${to}' WHERE creature_id = '${from}';
    UPDATE profiles SET selected_creature_id = '${to}' WHERE selected_creature_id = '${from}';
  `)
}

export async function up(pgm) {
  for (const [from, to] of creatureRenames) {
    await renameCreature(pgm, from, to)
  }
  for (const [from, to] of formRenames) {
    await pgm.sql(`UPDATE profiles SET selected_form_id = '${to}' WHERE selected_form_id = '${from}';`)
  }
}

export async function down(pgm) {
  for (const [from, to] of [...formRenames].reverse()) {
    await pgm.sql(`UPDATE profiles SET selected_form_id = '${from}' WHERE selected_form_id = '${to}';`)
  }
  for (const [from, to] of [...creatureRenames].reverse()) {
    await renameCreature(pgm, to, from)
  }
}
