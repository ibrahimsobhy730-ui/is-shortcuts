/* Proves the Round 4 deploy fix for the reply_media position index:
   drizzle/0001_init.sql used to contain
     CREATE INDEX IF NOT EXISTS reply_media_shortcut_pos_idx
       ON reply_media(shortcut_id, position);
   but the LIVE reply_media table was created by Round 3 WITHOUT a
   position column — the ALTER that adds it lives in the post-init
   block of scripts/setup-db.ts, which runs AFTER the init file.
   So on the live DB the init file's CREATE INDEX died with Postgres
   42703 (column "position" does not exist, routine ComputeIndexAttrs)
   at setup-db.ts:24:3, before `next build` started — that is what
   killed all three Round 4 deploys (dpl_H8i79WdRQ7fVxjCgSvCygg7HM3SM,
   dpl_F8feXn7NKgwBaoQbAizZcuWKjpNA, dpl_Cr9B2Fo6cVfRwV9nsSYQf3TTsfyy,
   6 seconds each). Fresh DBs never hit it (their CREATE TABLE
   includes position), which is why local builds and pg-mem passed.

   This test simulates the LIVE state, which every previous round
   missed: it downgrades reply_media to the exact Round 3 shape
   (no position column, old one-row-per-reply unique index
   reply_media_shortcut_idx, one seeded legacy row), then:
     (a) reproduces the production failure with the OLD index
         statement (the exact text from the build log) on that DB,
     (b) proves every CREATE INDEX statement in the CURRENT init
         file succeeds on that same DB,
     (c) runs the post-init block VERBATIM from scripts/setup-db.ts
         and proves position appears, the legacy row keeps position 1,
         and 3 images coexist ordered by position,
     (d) proves the fresh-DB path still works end to end.
   Usage: node scripts/verify-reply-media-index.mjs

   Two pg-mem limits shape this test (both are pg-mem-only; real
   Postgres does not have them):
   - pg-mem cannot re-run `CREATE TABLE IF NOT EXISTS` once the
     table exists (it throws an "AST not read by the query planner"
     error), so the whole init file cannot be re-applied to the
     Round-3 DB here. That is fine: in real Postgres those statements
     are skipped by definition (table exists), and the production
     failure was inside CREATE INDEX (routine ComputeIndexAttrs) —
     so the CREATE INDEX statements ARE the exact failure surface,
     and they are what (a)/(b) exercise, extracted from the file.
   - pg-mem's parser rejects the em dash inside the block comment
     of the post-init block, so the comment is omitted from the
     test copy below; every STATEMENT is verbatim from setup-db.ts.
   - This pg-mem build has no pg_indexes view and its pg_class
     lists no index rows, so the index itself cannot be read back
     from a catalog here. Existence is proven the only way pg-mem
     allows: the CREATE INDEX statement runs without error in the
     verbatim post-init block — on real Postgres that statement
     either creates the index or errors, and (a) proves the error
     path fires when the column is missing. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";

const root = join(import.meta.dirname, "..");
const ddl = readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8");
const setupDb = readFileSync(join(root, "scripts", "setup-db.ts"), "utf-8");

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ---- static checks: ownership + ordering in code ---- */
check(
  "init file has no CREATE INDEX for reply_media_shortcut_pos_idx",
  !ddl.includes("CREATE INDEX IF NOT EXISTS reply_media_shortcut_pos_idx"),
);
check(
  "init file still creates reply_media WITH position (fresh DBs)",
  ddl.includes("position INTEGER NOT NULL DEFAULT 1"),
);
const alterAt = setupDb.indexOf(
  "ALTER TABLE reply_media ADD COLUMN IF NOT EXISTS position",
);
const createAt = setupDb.indexOf(
  "CREATE INDEX IF NOT EXISTS reply_media_shortcut_pos_idx ON reply_media(shortcut_id, position)",
);
check(
  "setup-db.ts post-init creates the index AFTER the ALTER",
  alterAt > 0 && createAt > alterAt,
  `ALTER@${alterAt} CREATE@${createAt}`,
);

/* ---- the init file's CREATE INDEX statements (one per line) ----
   These are the only init-file statements that EXECUTE against an
   existing table in real Postgres (CREATE TABLE IF NOT EXISTS is
   skipped when the table exists); they are the exact failure
   surface from the build log. */
const indexStmts = [...ddl.matchAll(/^CREATE INDEX.*$/gm)].map((m) => m[0]);
check("init file yields its CREATE INDEX statements", indexStmts.length > 0, `${indexStmts.length} found`);
const LEGACY_POS_INDEX =
  "CREATE INDEX IF NOT EXISTS reply_media_shortcut_pos_idx ON reply_media(shortcut_id, position);";

/* ---- post-init block, statements copied VERBATIM from
   scripts/setup-db.ts (the second client.query: trigger ALTER +
   reply_media migration). The block comment is omitted: pg-mem's
   parser rejects the em dash inside it (real Postgres accepts it).
   The test would be meaningless if the statements drifted. ---- */
const POST_INIT_SQL = `
    ALTER TABLE shortcuts ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT '';
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
`;

/* Builds a pg-mem DB in the exact LIVE (Round 3) state: every table
   from the current init file, then reply_media downgraded — position
   column dropped, pos index dropped, old one-row-per-reply unique
   index restored — plus one seeded legacy media row (no position). */
const round3Db = async () => {
  const mem = newDb();
  await mem.public.none(ddl);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(`ALTER TABLE reply_media DROP COLUMN position`);
  await pool.query(`DROP INDEX IF EXISTS reply_media_shortcut_pos_idx`);
  await pool.query(`CREATE UNIQUE INDEX reply_media_shortcut_idx ON reply_media(shortcut_id)`);
  const {
    rows: [u],
  } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ('اختبار', 'rmi@example.com', 'x') RETURNING id`,
  );
  const {
    rows: [s],
  } = await pool.query(
    `INSERT INTO shortcuts (user_id, title, body) VALUES ($1, 'رد', 'نص') RETURNING id`,
    [u.id],
  );
  await pool.query(
    `INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size) VALUES ($1, $2, 'image', 'https://x/a.jpg', 'media/1/1/a.jpg', 'image/jpeg', 10)`,
    [s.id, u.id],
  );
  return { mem, pool, uid: u.id, sid: s.id };
};

const hasPositionColumn = async (pool) => {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'reply_media' AND column_name = 'position'`,
  );
  return rows.length === 1;
};

const runStmts = async (pool, stmts) => {
  for (const s of stmts) await pool.query(s);
  return null;
};

/* The post-init block as ONE multi-statement query works only when
   reply_media does not exist yet: pg-mem cannot re-run
   `CREATE TABLE IF NOT EXISTS` once the table exists (proven by
   bisect — every CREATE TABLE re-run throws the "AST not read"
   error), while real Postgres skips it by definition. In production
   that statement is always a no-op anyway: setup-db.ts runs the
   init file first, which creates reply_media, so the table exists
   by the time the post-init block runs. So: where the table exists,
   run the block statement-by-statement with the CREATE TABLE
   skipped; where it does not exist (DB-C), run the whole verbatim
   block as one query. The statements stay verbatim either way —
   they are split from the same constant, never re-typed. */
const postInitStmts = POST_INIT_SQL.split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const postInitWithoutCreateTable = postInitStmts.filter(
  (s) => !s.startsWith("CREATE TABLE IF NOT EXISTS reply_media"),
);
check(
  "post-init block splits into statements, exactly one CREATE TABLE",
  postInitStmts.length - postInitWithoutCreateTable.length === 1,
  `${postInitStmts.length} statements`,
);
/* The skipped CREATE TABLE is byte-identical (modulo indentation) to
   the init file's CREATE TABLE, which the fresh-DB path runs — so
   skipping it in the post-init run leaves nothing unproven. */
{
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const extractCreateTable = (src) => {
    const m = src.match(/CREATE TABLE IF NOT EXISTS reply_media \([\s\S]*?\);/);
    return m ? norm(m[0]) : null;
  };
  const initTable = extractCreateTable(ddl);
  const postInitTable = extractCreateTable(POST_INIT_SQL);
  check(
    "post-init CREATE TABLE matches the init file's (same columns)",
    initTable !== null && initTable === postInitTable,
  );
}

/* ---- DB-A: reproduce the production failure with the OLD index ---- */
{
  const { pool, sid } = await round3Db();
  void sid;
  let err = null;
  try {
    await pool.query(LEGACY_POS_INDEX);
  } catch (e) {
    err = e;
  }
  check(
    "REPRODUCTION: legacy pos-index statement FAILS on Round-3-shaped DB",
    err !== null,
    err ? err.message.split("\n")[0] : "no error — the bug did not reproduce!",
  );
  check(
    "failure names the missing position column (Postgres 42703 in prod)",
    err !== null && /position/.test(err.message),
    err ? err.message.split("\n")[0] : "",
  );
  await pool.end();
}

/* ---- DB-B: the fix — current init file's index statements + post-init ---- */
{
  const { pool, uid, sid } = await round3Db();
  check(
    "Round-3 DB starts with NO position column",
    (await hasPositionColumn(pool)) === false,
  );
  let err = null;
  try {
    await runStmts(pool, indexStmts);
  } catch (e) {
    err = e;
  }
  check(
    "FIX: every CREATE INDEX in the current init file SUCCEEDS on Round-3 DB",
    err === null,
    err ? err.message.split("\n")[0] : "",
  );
  let err2 = null;
  try {
    await runStmts(pool, postInitWithoutCreateTable);
  } catch (e) {
    err2 = e;
  }
  check(
    "post-init statements (verbatim from setup-db.ts, CREATE TABLE skipped — always a no-op in prod) SUCCEED",
    err2 === null,
    err2 ? err2.message.split("\n")[0] : "",
  );
  check(
    "after post-init, position column EXISTS",
    (await hasPositionColumn(pool)) === true,
  );
  let seeded = null;
  let seededErr = null;
  try {
    ({ rows: seeded } = await pool.query(
      `SELECT position FROM reply_media WHERE shortcut_id = $1`,
      [sid],
    ));
  } catch (e) {
    seededErr = e;
  }
  check(
    "seeded legacy row kept position 1 via DEFAULT",
    seededErr === null && seeded !== null && seeded.length === 1 && seeded[0].position === 1,
    seededErr ? seededErr.message.split("\n")[0] : JSON.stringify(seeded),
  );
  let err3 = null;
  try {
    await pool.query(
      `INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, position) VALUES ($1, $2, 'image', 'https://x/b.jpg', 'media/1/1/b.jpg', 'image/jpeg', 10, 2)`,
      [sid, uid],
    );
    await pool.query(
      `INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, position) VALUES ($1, $2, 'image', 'https://x/c.jpg', 'media/1/1/c.jpg', 'image/jpeg', 10, 3)`,
      [sid, uid],
    );
  } catch (e) {
    err3 = e;
  }
  check(
    "2nd + 3rd image insert fine (old one-row-per-reply unique index dropped)",
    err3 === null,
    err3 ? err3.message.split("\n")[0] : "",
  );
  let ordered = null;
  let orderedErr = null;
  try {
    ({ rows: ordered } = await pool.query(
      `SELECT position FROM reply_media WHERE shortcut_id = $1 ORDER BY position ASC`,
      [sid],
    ));
  } catch (e) {
    orderedErr = e;
  }
  check(
    "ordering lookup returns 1,2,3",
    orderedErr === null &&
      ordered !== null &&
      ordered.map((r) => r.position).join(",") === "1,2,3",
    orderedErr ? orderedErr.message.split("\n")[0] : JSON.stringify(ordered),
  );
  await pool.end();
}

/* ---- DB-C: fresh DB still works end to end (full init file once) ---- */
{
  const mem = newDb();
  await mem.public.none(ddl);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  // The init file already created reply_media (WITH position) just
  // above, so run the post-init statements with the CREATE TABLE
  // skipped — exactly as in DB-B. (The post-init CREATE TABLE is
  // byte-identical to the init file's CREATE TABLE, which just ran
  // successfully, so nothing is left unproven by skipping it here.
  // Dropping the table first to run the whole block was tried and
  // hits a pg-mem DROP TABLE quirk: the implicit pkey survives the
  // drop and re-creation fails with "relation already exists".)
  let err = null;
  try {
    await runStmts(pool, postInitWithoutCreateTable);
  } catch (e) {
    err = e;
  }
  check("fresh DB: post-init statements SUCCEED", err === null, err ? err.message.split("\n")[0] : "");
  check("fresh DB: position column EXISTS", (await hasPositionColumn(pool)) === true);
  let tailErr = null;
  let freshOrdered = null;
  try {
    const {
      rows: [u],
    } = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ('طازج', 'fresh@example.com', 'x') RETURNING id`,
    );
    const {
      rows: [s],
    } = await pool.query(
      `INSERT INTO shortcuts (user_id, title, body) VALUES ($1, 'رد', 'نص') RETURNING id`,
      [u.id],
    );
    await pool.query(
      `INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, position) VALUES ($1, $2, 'image', 'https://x/a.jpg', 'media/1/1/a.jpg', 'image/jpeg', 10, 2)`,
      [s.id, u.id],
    );
    await pool.query(
      `INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, position) VALUES ($1, $2, 'image', 'https://x/b.jpg', 'media/1/1/b.jpg', 'image/jpeg', 10, 1)`,
      [s.id, u.id],
    );
    ({ rows: freshOrdered } = await pool.query(
      `SELECT position FROM reply_media WHERE shortcut_id = $1 ORDER BY position ASC`,
      [s.id],
    ));
  } catch (e) {
    tailErr = e;
  }
  check(
    "fresh DB: ordering lookup returns 1,2",
    tailErr === null &&
      freshOrdered !== null &&
      freshOrdered.map((r) => r.position).join(",") === "1,2",
    tailErr ? tailErr.message.split("\n")[0] : JSON.stringify(freshOrdered),
  );
  await pool.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
