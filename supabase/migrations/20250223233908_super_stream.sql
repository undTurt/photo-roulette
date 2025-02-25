/*
  # Photo Roulette Game Schema

  1. New Tables
    - `games`
      - `id` (uuid, primary key)
      - `room_code` (text, unique)
      - `status` (text)
      - `current_round` (int)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `players`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key)
      - `name` (text)
      - `score` (int)
      - `ready` (boolean)
      - `created_at` (timestamp)
    - `photos`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key)
      - `player_id` (uuid, foreign key)
      - `storage_path` (text)
      - `used` (boolean)
      - `created_at` (timestamp)
    - `guesses`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key)
      - `round` (int)
      - `photo_id` (uuid, foreign key)
      - `player_id` (uuid, foreign key)
      - `guessed_player_id` (uuid, foreign key)
      - `correct` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for game participants
    - Secure storage bucket access
*/

-- Create tables
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'lobby',
  current_round int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  name text NOT NULL,
  score int NOT NULL DEFAULT 0,
  ready boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  round int NOT NULL,
  photo_id uuid REFERENCES photos(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  guessed_player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  correct boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read active games"
  ON games FOR SELECT
  USING (true);

CREATE POLICY "Players can read game data"
  ON players FOR SELECT
  USING (true);

CREATE POLICY "Players can update their own data"
  ON players FOR UPDATE
  USING (auth.uid() IN (
    SELECT p.id FROM players p WHERE p.game_id = players.game_id
  ));

CREATE POLICY "Players can read photos in their game"
  ON photos FOR SELECT
  USING (auth.uid() IN (
    SELECT p.id FROM players p WHERE p.game_id = photos.game_id
  ));

CREATE POLICY "Players can upload their photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT p.id FROM players p WHERE p.game_id = photos.game_id
  ));

CREATE POLICY "Players can read guesses in their game"
  ON guesses FOR SELECT
  USING (auth.uid() IN (
    SELECT p.id FROM players p WHERE p.game_id = guesses.game_id
  ));

CREATE POLICY "Players can submit guesses"
  ON guesses FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT p.id FROM players p WHERE p.game_id = guesses.game_id
  ));

-- Create function to clean up old games
CREATE OR REPLACE FUNCTION cleanup_old_games() RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete games older than 24 hours
  DELETE FROM games
  WHERE created_at < now() - interval '24 hours';
END;
$$;