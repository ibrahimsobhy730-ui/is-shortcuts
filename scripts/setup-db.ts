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
  const { rows } = await client.query(`
    SELECT 'users' AS t, COUNT(*)::int AS n FROM users
    UNION ALL SELECT 'folders', COUNT(*)::int FROM folders
    UNION ALL SELECT 'shortcuts', COUNT(*)::int FROM shortcuts
    UNION ALL SELECT 'sessions', COUNT(*)::int FROM sessions
    UNION ALL SELECT 'copy_history', COUNT(*)::int FROM copy_history
    UNION ALL SELECT 'smart_folders', COUNT(*)::int FROM smart_folders
    UNION ALL SELECT 'site_config', COUNT(*)::int FROM site_config
    UNION ALL SELECT 'avatar_blobs', COUNT(*)::int FROM avatar_blobs
    ORDER BY 1`);
  console.log("Schema applied. Row counts:");
  for (const r of rows) console.log(`  ${r.t}: ${r.n}`);
} finally {
  await client.end();
}
