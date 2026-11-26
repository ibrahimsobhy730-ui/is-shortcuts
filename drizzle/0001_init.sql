-- IS — Postgres schema (Neon). Hand-written to match lib/schema.ts exactly
-- (the drizzle pg-core port of the Muse artifact's SQLite schema,
-- migrations 0001-0021 applied). Apply with: bun run db:setup
-- (scripts/setup-db.ts) or psql -f this file.
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  google_email TEXT,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_blob_key TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS copy_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  shortcut_id INTEGER,
  title TEXT NOT NULL,
  copied_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS copy_history_user_id_idx ON copy_history(user_id);
CREATE INDEX IF NOT EXISTS copy_history_copied_at_idx ON copy_history(user_id, copied_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  expires_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  icon TEXT,
  icon_color TEXT,
  source TEXT NOT NULL DEFAULT '',
  is_source_main BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id INTEGER,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP(3),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders(user_id);
CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id);

CREATE TABLE IF NOT EXISTS smart_folders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  icon TEXT,
  icon_color TEXT,
  tags TEXT NOT NULL DEFAULT '',
  folder_id INTEGER,
  pinned_only BOOLEAN NOT NULL DEFAULT FALSE,
  favorite_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_uses INTEGER,
  unused_days INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS smart_folders_user_id_idx ON smart_folders(user_id);

CREATE TABLE IF NOT EXISTS shortcuts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  tags TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT '',
  ext_shortcut TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  folder_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMP(3),
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shortcuts_user_id_idx ON shortcuts(user_id);
CREATE INDEX IF NOT EXISTS shortcuts_folder_id_idx ON shortcuts(folder_id);
-- Per-user trigger uniqueness: the same trigger word may exist for
-- different accounts, but never twice in one account's live library.
CREATE UNIQUE INDEX IF NOT EXISTS shortcuts_user_trigger_idx ON shortcuts(user_id, trigger) WHERE trigger <> '';

-- Profile-picture bytes (replaces the Muse artifact's ctx.blobs store).
-- Key is `avatars/<userId>`, same as before.
CREATE TABLE IF NOT EXISTS avatar_blobs (
  key TEXT PRIMARY KEY,
  data BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
