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
    /* Reply media (images attached to a reply, stored in
       Vercel Blob — the table holds only the reference, never the
       bytes). Up to 3 images per reply (position 1–3), ordered;
       deleting the reply deletes its media rows (the Blob objects
       themselves are deleted by the action handlers, with a
       refcount guard, since a duplicate shares the same Blob
       objects). Live databases created before position existed
       get the column + the new index here; the old one-row-per-
       reply unique index is dropped (it would reject a 2nd
       image). Existing rows keep position 1 via the DEFAULT. */
    CREATE TABLE IF NOT EXISTS reply_media (
      id SERIAL PRIMARY KEY,
      shortcut_id INTEGER NOT NULL REFERENCES shortcuts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      position INTEGER NOT NULL DEFAULT 1,
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
    ALTER TABLE reply_media ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 1;
    DROP INDEX IF EXISTS reply_media_shortcut_idx;
    CREATE INDEX IF NOT EXISTS reply_media_shortcut_pos_idx ON reply_media(shortcut_id, position);
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
