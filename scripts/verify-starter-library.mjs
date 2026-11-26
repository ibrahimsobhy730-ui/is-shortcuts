/* Test-only end-to-end check of this round's shortcuts work against
   pg-mem (an in-memory Postgres emulator — no real Neon instance is
   available in this VM). It applies drizzle/0001_init.sql, then
   exercises the handlers exactly as /api/actions would call them:
   - starter library: owner picks a set from his own library
     (get/setStarterLibrary), registration copies it into the new
     user's own library; no set yet -> new account starts empty;
     existing users are never touched; non-owners cannot read or set.
   - last-used ordering: sortTriggersRecency (recency first, then
     never-used in usage order) extracted verbatim from
     components/App.tsx and tested as a pure function.
   - new-reply trigger suggestions: static check that the editor
     computes suggestTriggers for brand-new replies too (item null)
     and renders the one-tap chips — the same engine as the inline
     pill editor, no second engine.
   - your-shortcuts card text: static check of the exact copy format
     (`trigger → title`, one line per shortcut).
   Usage: node scripts/verify-starter-library.mjs */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/pg-proxy";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { Actions } from "../lib/actions.ts";
import * as schema from "../lib/schema.ts";

const root = join(import.meta.dirname, "..");
const mem = newDb();
const ddl = readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8");
await mem.public.none(ddl);
console.log("DDL applied to pg-mem.");

// Same pg-proxy driver setup as scripts/verify-actions.mjs (see its
// header for the two pg-mem quirks this works around).
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
    async put(key, bytes, opts) {
      blobs.set(key, { bytes, contentType: opts.contentType });
    },
    async delete(key) {
      blobs.delete(key);
    },
    async head(key) {
      return blobs.has(key) ? { contentType: "image/jpeg" } : null;
    },
  },
  invalidateQueries() {},
  invalidateKeys() {},
  invalidated: false,
  invalidatedKeys: null,
};

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const call = async (name, args) => {
  const def = Actions[name];
  if (!def) throw new Error(`no action ${name}`);
  const parsed = def.request.safeParse(args);
  if (!parsed.success)
    throw new Error(`request invalid: ${JSON.stringify(parsed.error.issues)}`);
  const out = await def.handler(ctx, parsed.data);
  const checked = def.response.safeParse(out);
  if (!checked.success)
    throw new Error(`response invalid: ${JSON.stringify(checked.error.issues)}`);
  return checked.data;
};

const callThrows = async (name, args) => {
  try {
    await call(name, args);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

const listTitles = async (token) =>
  (await call("listShortcuts", { token })).shortcuts;

try {
  // ---- owner registers first: pre-existing behaviour kept — the
  // first account is auto-seeded with the 86-reply playbook pack.
  const ownerReg = await call("register", {
    name: "Ibrahim Sobhi",
    email: "owner@example.com",
    phone: "01012345678",
    password: "1234",
  });
  check("owner registers", ownerReg.ok === true && !!ownerReg.token);
  const ownerToken = ownerReg.token;
  const ownerId = ownerReg.user.id;
  const ownerLib0 = await listTitles(ownerToken);
  check(
    "first account still auto-seeded with playbook (86)",
    ownerLib0.length === 86,
    `n=${ownerLib0.length}`,
  );

  // ---- owner adds 3 of his own replies to choose from.
  const mk = async (title, trigger) =>
    (
      await call("createShortcut", {
        token: ownerToken,
        title,
        body: `نص ${title}`,
        category: "مكتبة بداية",
        trigger,
      })
    ).shortcut;
  const a = await mk("بداية أ", "start-a");
  const b = await mk("بداية ب", "start-b");
  const c = await mk("بداية ج", "start-c");
  check("owner creates 3 replies", !!a.id && !!b.id && !!c.id);

  // ---- no set chosen yet: owner reads an empty set.
  const emptyLib = await call("getStarterLibrary", { token: ownerToken });
  check(
    "getStarterLibrary: owner, nothing chosen yet",
    emptyLib.isOwner === true && emptyLib.chosen.length === 0,
  );

  // ---- owner picks 2 of the 3 (order kept).
  const set1 = await call("setStarterLibrary", {
    token: ownerToken,
    shortcutIds: [b.id, a.id],
  });
  check("setStarterLibrary saves 2", set1.saved === 2);
  const lib1 = await call("getStarterLibrary", { token: ownerToken });
  check(
    "getStarterLibrary returns chosen in owner's order",
    lib1.isOwner === true &&
      lib1.chosen.length === 2 &&
      lib1.chosen[0].id === b.id &&
      lib1.chosen[1].id === a.id &&
      lib1.chosen[0].title === "بداية ب",
    JSON.stringify(lib1.chosen.map((x) => x.title)),
  );

  // ---- invalid picks are refused.
  const badForeign = await callThrows("setStarterLibrary", {
    token: ownerToken,
    shortcutIds: [999999],
  });
  check("setStarterLibrary rejects ids outside owner's library", !!badForeign, badForeign ?? "");
  const tooMany = await callThrows("setStarterLibrary", {
    token: ownerToken,
    shortcutIds: Array.from({ length: 101 }, (_, i) => i + 1),
  });
  check("setStarterLibrary rejects >100 ids", !!tooMany);
  const libStill = await call("getStarterLibrary", { token: ownerToken });
  check(
    "rejected set leaves the stored set untouched",
    libStill.chosen.length === 2 && libStill.chosen[0].id === b.id,
  );

  // ---- new user B registers: gets copies of exactly the 2 chosen.
  const regB = await call("register", {
    name: "User B",
    email: "b@example.com",
    phone: "01022222222",
    password: "1234",
  });
  check("user B registers", regB.ok === true && !!regB.token);
  const libB = await listTitles(regB.token);
  const titlesB = libB.map((s) => s.title).sort();
  check(
    "B starts with exactly the 2 chosen replies",
    libB.length === 2 &&
      titlesB[0] === "بداية أ" &&
      titlesB[1] === "بداية ب",
    `n=${libB.length} titles=${JSON.stringify(titlesB)}`,
  );
  const copyB = libB.find((s) => s.title === "بداية ب");
  check(
    "B's copies are his own rows (own ids, trigger copied, fresh counters)",
    !!copyB &&
      copyB.id !== b.id &&
      copyB.trigger === "start-b" &&
      copyB.usageCount === 0 &&
      copyB.lastUsedAt === null,
    JSON.stringify({
      id: copyB?.id,
      trigger: copyB?.trigger,
      usageCount: copyB?.usageCount,
      lastUsedAt: copyB?.lastUsedAt,
    }),
  );

  // ---- owner's library is untouched by B's registration.
  const ownerLib1 = await listTitles(ownerToken);
  check(
    "owner's library untouched by B's registration",
    ownerLib1.length === 89 &&
      ownerLib1.some((s) => s.id === a.id) &&
      ownerLib1.some((s) => s.id === b.id) &&
      ownerLib1.some((s) => s.id === c.id),
    `n=${ownerLib1.length}`,
  );

  // ---- non-owner: cannot read the set, cannot set it.
  const libBRead = await call("getStarterLibrary", { token: regB.token });
  check(
    "getStarterLibrary: non-owner gets isOwner false + empty",
    libBRead.isOwner === false && libBRead.chosen.length === 0,
  );
  const bSetErr = await callThrows("setStarterLibrary", {
    token: regB.token,
    shortcutIds: [copyB.id],
  });
  check("setStarterLibrary: non-owner refused", !!bSetErr, bSetErr ?? "");

  // ---- owner clears the set; new user C starts empty (guided
  // empty state), and B is still untouched.
  const cleared = await call("setStarterLibrary", {
    token: ownerToken,
    shortcutIds: [],
  });
  check("owner clears the set", cleared.saved === 0);
  const regC = await call("register", {
    name: "User C",
    email: "c@example.com",
    phone: "01033333333",
    password: "1234",
  });
  const libC = await listTitles(regC.token);
  check(
    "no set chosen: new account C starts empty",
    libC.length === 0,
    `n=${libC.length}`,
  );
  const libB2 = await listTitles(regB.token);
  check(
    "existing user B untouched by later registrations",
    libB2.length === 2,
    `n=${libB2.length}`,
  );

  // ---- last-used ordering (pure function, verbatim from App.tsx).
  const appSrc = readFileSync(join(root, "components", "App.tsx"), "utf-8");
  const grab = (re, name) => {
    const m = appSrc.match(re);
    if (!m) throw new Error("not found: " + name);
    return m[0];
  };
  const recencyCode = grab(
    /function sortTriggersRecency<[\s\S]*?\n\}/,
    "sortTriggersRecency",
  );
  const recencyJs = transpileModule(recencyCode, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.CommonJS },
  }).outputText;
  const sortRecency = new Function(`${recencyJs}\nreturn sortTriggersRecency;`)();
  const rows = [
    { id: 1, trigger: "old", usageCount: 5, lastUsedAt: "2026-11-20T10:00:00.000Z" },
    { id: 2, trigger: "new", usageCount: 1, lastUsedAt: "2026-11-26T10:00:00.000Z" },
    { id: 3, trigger: "never-much", usageCount: 9, lastUsedAt: null },
    { id: 4, trigger: "never-less", usageCount: 2, lastUsedAt: null },
    { id: 5, trigger: "mid", usageCount: 3, lastUsedAt: "2026-11-25T10:00:00.000Z" },
  ];
  const ordered = sortRecency(rows).map((r) => r.trigger);
  check(
    "recency: most recent copy first, never-used below in usage order",
    JSON.stringify(ordered) ===
      JSON.stringify(["new", "mid", "old", "never-much", "never-less"]),
    JSON.stringify(ordered),
  );
  check(
    "recency: recency beats total count (1-use recent outranks 5-use old)",
    ordered[0] === "new" && ordered[2] === "old",
  );
  check("recency: empty list stays empty", sortRecency([]).length === 0);

  // ---- new-reply suggestions: the editor computes the same engine
  // for brand-new replies (item null) and renders the one-tap chips.
  // (The editor lives in components/modals/EditorModal.tsx since the
  // 2026-11-26 modal split — App.tsx only renders it.)
  const editorSrc = readFileSync(
    join(root, "components", "modals", "EditorModal.tsx"),
    "utf-8",
  );
  check(
    "editor computes suggestTriggers for new replies too (item?.trigger ?? null)",
    editorSrc.includes("trigger: item?.trigger ?? null"),
  );
  check(
    "editor renders one-tap suggestion chips (triggerSuggestions.map)",
    editorSrc.includes("triggerSuggestions.map((sug)"),
  );
  check(
    "new-reply call site passes ALL triggers as taken (item null -> -1)",
    appSrc.includes(
      "takenTriggers={takenTriggersById.get(editor.item?.id ?? -1) ?? []}",
    ) && appSrc.includes("m.set(-1, otherTriggers(shortcuts, -1))"),
  );
  check(
    "no second suggestions engine invented (single suggestTriggers def)",
    (appSrc.match(/function suggestTriggers\(/g) ?? []).length === 1,
  );

  // ---- your-shortcuts card: exact copy format, one line per trigger.
  check(
    "card copies as `trigger → title` lines joined by newline",
    appSrc.includes("items.map((s) => `${s.trigger} → ${s.title}`).join(\"\\n\")"),
  );
  check(
    "card shows an empty state when there are no triggers (no fake rows)",
    appSrc.includes("لسه مفيش اختصارات في الكارت"),
  );
  check(
    "shortcut bar sorts the empty-query list by recency",
    appSrc.includes("if (!q) return sortTriggersRecency(list);"),
  );
  check(
    "shortcut bar labels the recent section «آخر اختصارات استخدمتها»",
    appSrc.includes('t("آخر اختصارات استخدمتها")'),
  );
} catch (e) {
  fail++;
  console.log(`FAIL  harness threw — ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
