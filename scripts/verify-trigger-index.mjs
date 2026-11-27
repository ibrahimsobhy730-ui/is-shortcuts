/* Proves the trigger-index split introduced when the CREATE UNIQUE
   INDEX line was removed from drizzle/0001_init.sql (Round 4 deploy
   fix): the init file alone must NOT create shortcuts_user_trigger_idx
   (it is applied by scripts/setup-db.ts as one multi-statement query
   BEFORE the guarded step, so an index there would abort the whole
   build on live duplicate triggers), and the guarded step in
   setup-db.ts — duplicate pre-check, warn-and-skip instead of failing
   — must still create that exact index, with predicate
   WHERE trigger <> '' AND deleted_at IS NULL, for fresh databases.
   The two guarded-step queries below are copied VERBATIM from
   scripts/setup-db.ts (dup pre-check subquery + DROP/CREATE block).
   Usage: node scripts/verify-trigger-index.mjs */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";

const root = join(import.meta.dirname, "..");
const ddl = readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8");

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const freshDb = async () => {
  const mem = newDb();
  await mem.public.none(ddl);
  const { Pool } = mem.adapters.createPg();
  return new Pool();
};

// Verbatim from scripts/setup-db.ts: the duplicate pre-check.
const DUP_CHECK_SQL = `
    SELECT user_id, t, n FROM (
      SELECT user_id, lower(trigger) AS t, COUNT(*)::int AS n
      FROM shortcuts
      WHERE trigger <> '' AND deleted_at IS NULL
      GROUP BY user_id, lower(trigger)
    ) dups WHERE n > 1`;
// Verbatim from scripts/setup-db.ts: the guarded index creation.
const CREATE_INDEX_SQL = `
      DROP INDEX IF EXISTS shortcuts_user_trigger_idx;
      CREATE UNIQUE INDEX IF NOT EXISTS shortcuts_user_trigger_idx
        ON shortcuts(user_id, lower(trigger))
        WHERE trigger <> '' AND deleted_at IS NULL;
`;

// Runs the guarded step exactly as setup-db.ts does: pre-check first,
// create only when no live duplicates exist.
const runGuardedStep = async (pool) => {
  const { rows } = await pool.query(DUP_CHECK_SQL);
  if (rows.length > 0) return { skipped: true, dups: rows };
  await pool.query(CREATE_INDEX_SQL);
  return { skipped: false };
};

const indexDef = async (pool) => {
  try {
    const { rows } = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'shortcuts_user_trigger_idx'`,
    );
    return rows.length ? rows[0].indexdef : null;
  } catch {
    return undefined; // pg-mem without pg_indexes: behavioral checks decide
  }
};

const seedUser = async (pool) => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ('اختبار', 'idx-test@example.com', 'x') RETURNING id`,
  );
  return rows[0].id;
};
const mkReply = async (pool, uid, title, trigger, deleted = false) => {
  await pool.query(
    `INSERT INTO shortcuts (user_id, title, body, trigger, deleted_at) VALUES ($1, $2, 'نص', $3, $4)`,
    [uid, title, trigger, deleted ? new Date().toISOString() : null],
  );
};
const tryInsert = async (pool, uid, title, trigger) => {
  try {
    await mkReply(pool, uid, title, trigger);
    return null; // no error
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

/* ---- DB0: the init file alone creates NO trigger index ---- */
{
  const pool = await freshDb();
  const uid = await seedUser(pool);
  await mkReply(pool, uid, "أ", "dup-one");
  const err = await tryInsert(pool, uid, "ب", "dup-one");
  check("init file alone: duplicate live trigger inserts fine (no index)", err === null, err ?? "");
  const def = await indexDef(pool);
  if (def !== undefined) check("init file alone: pg_indexes has no shortcuts_user_trigger_idx", def === null);
  await pool.end();
}

/* ---- DB1: guarded step on clean data creates the exact index ---- */
{
  const pool = await freshDb();
  const uid = await seedUser(pool);
  const uid2 = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ('ثان', 'idx-test2@example.com', 'x') RETURNING id`,
  ).then((r) => r.rows[0].id);
  await mkReply(pool, uid, "live-abc", "abc");
  await mkReply(pool, uid, "live-xyz", "xyz");
  await mkReply(pool, uid, "trashed-abc", "abc", true); // deleted row, same trigger
  await mkReply(pool, uid, "no-trigger-1", "");
  await mkReply(pool, uid, "no-trigger-2", "");

  const step = await runGuardedStep(pool);
  check("guarded step runs (no live dups, not skipped)", step.skipped === false);
  const def = await indexDef(pool);
  if (def !== undefined) {
    check("index exists in pg_indexes", def !== null, def ?? "");
    check("indexdef is UNIQUE", def !== null && /UNIQUE/i.test(def), def ?? "");
    check("indexdef uses lower(trigger)", def !== null && def.includes("lower(trigger)"), def ?? "");
    check("indexdef predicate excludes empty triggers", def !== null && def.includes("trigger <> ''"), def ?? "");
    check("indexdef predicate excludes deleted rows", def !== null && def.includes("deleted_at IS NULL"), def ?? "");
  } else {
    console.log("NOTE  pg_indexes unavailable in this pg-mem build — predicate proven behaviorally below");
  }

  // Behavioral proof of the predicate, one clause at a time:
  const errCase = await tryInsert(pool, uid, "dup-case", "ABC");
  check("case-insensitive duplicate rejected (lower(trigger))", errCase !== null, errCase ?? "inserted!");
  const errSame = await tryInsert(pool, uid, "dup-same", "xyz");
  check("exact duplicate rejected", errSame !== null, errSame ?? "inserted!");
  const errOtherUser = await tryInsert(pool, uid2, "other-user", "abc");
  check("same trigger for a DIFFERENT user still allowed (per-user)", errOtherUser === null, errOtherUser ?? "");
  const errEmpty = await tryInsert(pool, uid, "no-trigger-3", "");
  check("empty trigger duplicates allowed (trigger <> '')", errEmpty === null, errEmpty ?? "");
  // A trashed reply frees its trigger: delete the live 'xyz', then re-take it.
  await pool.query(`UPDATE shortcuts SET deleted_at = now() WHERE user_id = $1 AND trigger = 'xyz' AND deleted_at IS NULL`, [uid]);
  const errFreed = await tryInsert(pool, uid, "retake-xyz", "xyz");
  check("trashed reply frees its trigger (deleted_at IS NULL)", errFreed === null, errFreed ?? "");
  await pool.end();
}

/* ---- DB2: guarded step on live duplicates warns and skips ---- */
{
  const pool = await freshDb();
  const uid = await seedUser(pool);
  await mkReply(pool, uid, "dup-a", "dup");
  await mkReply(pool, uid, "dup-b", "dup");
  const step = await runGuardedStep(pool);
  check("guarded step SKIPS when live duplicates exist", step.skipped === true);
  check("skip reports the duplicate", step.dups?.length === 1 && step.dups[0].n === 2,
    JSON.stringify(step.dups ?? []));
  const def = await indexDef(pool);
  if (def !== undefined) check("no index created after skip", def === null);
  const err = await tryInsert(pool, uid, "dup-c", "dup");
  check("inserts still work after skip (build would not fail)", err === null, err ?? "");
  await pool.end();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
