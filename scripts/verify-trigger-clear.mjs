/* Test-only focused check for the 2026-11-26 verification anomaly:
   one «مسح» (clear) on trigger «xyz123» dropped the Shortcuts counter
   3 -> 1 and «تيست» gained +1 usage. Drives the REAL server actions
   against pg-mem (same harness as scripts/verify-actions.mjs):
   three replies with triggers, usage 4 on «تيست», then clear exactly
   one trigger through updateShortcut — the exact call the client's
   TriggerIcon «مسح» button makes — and assert the other two triggers
   and all usage counts are untouched.
   Usage: node scripts/verify-trigger-clear.mjs */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/pg-proxy";
import { Actions } from "../lib/actions.ts";
import * as schema from "../lib/schema.ts";

const root = join(import.meta.dirname, "..");
const mem = newDb();
await mem.public.none(readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8"));
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
const db = drizzle(
  async (sql, params) => {
    const res = await pool.query(sql, params);
    const keys = res.rows.length > 0 ? Object.keys(res.rows[0]) : [];
    return { rows: res.rows.map((r) => keys.map((c) => r[c])) };
  },
  { schema },
);
const blobs = new Map();
const ctx = {
  db: () => db,
  blobs: {
    async getUrl(key) {
      if (!blobs.has(key)) throw new Error("blob missing");
      return `/api/avatar/${key.split("/")[1]}`;
    },
    async put(key, bytes, opts) { blobs.set(key, { bytes, contentType: opts.contentType }); },
    async delete(key) { blobs.delete(key); },
  },
  invalidateQueries() {},
  invalidateKeys() {},
  invalidated: false,
  invalidatedKeys: null,
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
const call = async (name, args) => {
  const def = Actions[name];
  const parsed = def.request.safeParse(args);
  if (!parsed.success) throw new Error(`request invalid: ${JSON.stringify(parsed.error.issues)}`);
  const out = await def.handler(ctx, parsed.data);
  const checked = def.response.safeParse(out);
  if (!checked.success) throw new Error(`response invalid: ${JSON.stringify(checked.error.issues)}`);
  return checked.data;
};

const reg = await call("register", {
  name: "اختبار", email: "clear-test@example.com", phone: "01012345678", password: "1234",
});
const token = reg.token;
const mk = async (title, trigger) => {
  const c = await call("createShortcut", {
    token, title, body: `نص ${title}`, category: "قواعد", tags: "", extShortcut: "", source: "", trigger,
  });
  return c.shortcut.id;
};
const idTest = await mk("تيست", "ترحيب");
const idSalam = await mk("رد السلام", "xyz123");
const idBtd = await mk("ابتدائي أقل من رابع", "12");

// «تيست» usage 4, like the live state at the time of the anomaly.
for (let i = 0; i < 4; i++) await call("recordUse", { token, id: idTest });

const trigCount = async () => {
  const l = await call("listShortcuts", { token });
  const mine = l.shortcuts.filter((s) => [idTest, idSalam, idBtd].includes(s.id));
  return { list: l.shortcuts, mine };
};
const before = await trigCount();
const testBefore = before.mine.find((s) => s.id === idTest);
check("setup: 3 triggers present", before.mine.filter((s) => s.trigger).length === 3);
check("setup: «تيست» usage is 4", testBefore.usageCount === 4, `usage=${testBefore.usageCount}`);
const histBefore = await call("listCopyHistory", { token });

// The exact clear the client's «مسح» button performs: updateShortcut
// for ONE id with trigger "" (full reply re-sent, only trigger changed).
const cleared = await call("updateShortcut", {
  token, id: idSalam, title: "رد السلام", body: "نص رد السلام",
  category: "قواعد", tags: "", extShortcut: "", source: "", trigger: "",
});
check("clear call succeeds", cleared.ok === true);

const after = await trigCount();
const testAfter = after.mine.find((s) => s.id === idTest);
const salamAfter = after.mine.find((s) => s.id === idSalam);
const btdAfter = after.mine.find((s) => s.id === idBtd);
check("counter drops by exactly 1 (3 -> 2)", after.mine.filter((s) => s.trigger).length === 2,
  `n=${after.mine.filter((s) => s.trigger).length}`);
check("cleared reply lost its trigger only", salamAfter.trigger === "" && salamAfter.title === "رد السلام");
check("«ترحيب» on «تيست» untouched", testAfter.trigger === "ترحيب", `trigger=${testAfter.trigger}`);
check("«12» untouched", btdAfter.trigger === "12", `trigger=${btdAfter.trigger}`);
check("«تيست» usage still 4 (clear records no use)", testAfter.usageCount === 4, `usage=${testAfter.usageCount}`);
const histAfter = await call("listCopyHistory", { token });
check("copy history unchanged by the clear", histAfter.entries.length === histBefore.entries.length,
  `before=${histBefore.entries.length} after=${histAfter.entries.length}`);

// Server dedupe still holds: «ترحيب» cannot be re-taken while it lives on «تيست».
let dupRejected = false;
try {
  await call("updateShortcut", {
    token, id: idBtd, title: "ابتدائي أقل من رابع", body: "نص ابتدائي أقل من رابع",
    category: "قواعد", tags: "", extShortcut: "", source: "", trigger: "ترحيب",
  });
} catch { dupRejected = true; }
check("duplicate trigger still rejected server-side", dupRejected);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
