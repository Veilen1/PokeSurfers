export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE accounts (
      id uuid PRIMARY KEY,
      username varchar(20) NOT NULL
        CHECK (username ~ '^[A-Za-z0-9_]{3,20}$'),
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX accounts_username_case_insensitive_unique
      ON accounts (lower(username));

    CREATE TABLE profiles (
      user_id uuid PRIMARY KEY
        REFERENCES accounts(id) ON DELETE CASCADE,
      coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
      selected_creature_id varchar(40) NOT NULL,
      selected_form_id varchar(40) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE unlocked_creatures (
      user_id uuid NOT NULL
        REFERENCES accounts(id) ON DELETE CASCADE,
      creature_id varchar(40) NOT NULL,
      unlocked_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, creature_id)
    );

    CREATE TABLE creature_progress (
      user_id uuid NOT NULL
        REFERENCES accounts(id) ON DELETE CASCADE,
      creature_id varchar(40) NOT NULL,
      xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, creature_id)
    );

    CREATE TABLE runs (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL
        REFERENCES accounts(id) ON DELETE CASCADE,
      creature_id varchar(40) NOT NULL,
      score integer NOT NULL CHECK (score >= 0 AND score <= 10000000),
      coins_earned integer NOT NULL CHECK (coins_earned >= 0),
      duration_ms integer NOT NULL CHECK (duration_ms >= 1000 AND duration_ms <= 3600000),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX runs_score_created_at_idx
      ON runs (score DESC, created_at DESC);
    CREATE INDEX runs_user_id_created_at_idx
      ON runs (user_id, created_at DESC);
  `)
}

export async function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS runs;
    DROP TABLE IF EXISTS creature_progress;
    DROP TABLE IF EXISTS unlocked_creatures;
    DROP TABLE IF EXISTS profiles;
    DROP TABLE IF EXISTS accounts;
  `)
}
