/* Applies drizzle/0001_init.sql to the Neon database and prints row
   counts. Idempotent — safe to run again.
   Usage: DATABASE_URL=postgresql://... node scripts/setup-db.ts
   (DATABASE_URL can also come from .env.local — this script does NOT
   read .env files itself; Next.js does that at runtime.) */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and set it,\n" +
      "or export DATABASE_URL for this command.",
  );
  process.exit(1);
}

const sql = readFileSync(join(import.meta.dirname, "..", "drizzle", "0001_init.sql"), "utf-8");
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query(sql);
  /* Trigger column (added after the first deploy): the init file
     above creates it for fresh databases; live databases created
     before it need the idempotent ALTER + unique index below, run
     on every build so no manual migration step is ever needed. */
  await client.query(`
    ALTER TABLE shortcuts ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT '';
    /* Case-insensitive trigger uniqueness at the DB level: the old
       index compared trigger byte-for-byte, so "Salam" and "salam"
       could both exist and only the server check caught it. Drop
       the old index first (it may exist from an earlier build),
       then create the lower() one. */
    DROP INDEX IF EXISTS shortcuts_user_trigger_idx;
    CREATE UNIQUE INDEX IF NOT EXISTS shortcuts_user_trigger_idx ON shortcuts(user_id, lower(trigger)) WHERE trigger <> '';
    /* Reply media (images + video attached to a reply, stored in
       Vercel Blob — the table holds only the reference, never the
       bytes). One media per reply (unique shortcut_id); deleting
       the reply deletes its media row (the Blob object itself is
       deleted by the action handlers, with a refcount guard, since
       a duplicate shares the same Blob object). */
    CREATE TABLE IF NOT EXISTS reply_media (
      id SERIAL PRIMARY KEY,
      shortcut_id INTEGER NOT NULL REFERENCES shortcuts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL CHECK (kind IN ('image','video')),
      blob_url TEXT NOT NULL,
      blob_pathname TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size > 0),
      width INTEGER,
      height INTEGER,
      duration_ms INTEGER,
      created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
      updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS reply_media_shortcut_idx ON reply_media(shortcut_id);
    CREATE INDEX IF NOT EXISTS reply_media_user_idx ON reply_media(user_id);
    CREATE INDEX IF NOT EXISTS reply_media_pathname_idx ON reply_media(blob_pathname);
  `);
  const { rows } = await client.query(`
    SELECT 'users' AS t, COUNT(*)::int AS n FROM users
    UNION ALL SELECT 'folders', COUNT(*)::int FROM folders
    UNION ALL SELECT 'shortcuts', COUNT(*)::int FROM shortcuts
    UNION ALL SELECT 'sessions', COUNT(*)::int FROM sessions
    UNION ALL SELECT 'copy_history', COUNT(*)::int FROM copy_history
    UNION ALL SELECT 'smart_folders', COUNT(*)::int FROM smart_folders
    UNION ALL SELECT 'site_config', COUNT(*)::int FROM site_config
    UNION ALL SELECT 'avatar_blobs', COUNT(*)::int FROM avatar_blobs
    UNION ALL SELECT 'reply_media', COUNT(*)::int FROM reply_media
    ORDER BY 1`);
  console.log("Schema applied. Row counts:");
  for (const r of rows) console.log(`  ${r.t}: ${r.n}`);
} finally {
  await client.end();
}
