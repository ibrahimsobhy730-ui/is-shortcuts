/* Test-only end-to-end check of the ported server actions against
   pg-mem (an in-memory Postgres emulator — no real Neon instance is
   available in this VM). It applies drizzle/0001_init.sql, then
   exercises the handlers exactly as /api/actions would call them:
   register → login (incl. Arabic-Indic digit variants) → starter
   pack → shortcuts/folders → copy history → trash/restore →
   avatar → import dedupe → logout.
   Usage: node scripts/verify-actions.mjs */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/pg-proxy";
import { Actions } from "../lib/actions.ts";
import * as schema from "../lib/schema.ts";

const root = join(import.meta.dirname, "..");
const mem = newDb();
const ddl = readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8");
await mem.public.none(ddl);
console.log("DDL applied to pg-mem.");

// pg-proxy driver over pg-mem's Pool adapter. Two pg-mem quirks make
// the obvious paths fail, both emulator-only (real Postgres is fine):
// - drizzle's node-postgres driver passes a `types` override that
//   calls pg's getTypeParser, which pg-mem's client lacks;
// - mem.public.query() with parameters throws "No execution context
//   available". pool.query() with parameters works, and timestamps
//   already come back as JS Dates, so no type parsing is needed.
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
// pg-proxy's mapResultRow indexes rows by column position, so the
// callback must return rows as arrays in SELECT order (pg-mem's Pool
// returns fields: [], but Object.keys() follows SELECT order).
const db = drizzle(
  async (sql, params) => {
    const res = await pool.query(sql, params);
    const keys = res.rows.length > 0 ? Object.keys(res.rows[0]) : [];
    return { rows: res.rows.map((r) => keys.map((c) => r[c])) };
  },
  { schema },
);

// In-memory blob store standing in for the avatar_blobs table path
// (the handlers only touch ctx.blobs through getUrl/put/delete).
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
  },
  invalidateQueries() {},
  invalidated: false,
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const call = async (name, args) => {
  const def = Actions[name];
  if (!def) throw new Error(`no action ${name}`);
  const parsed = def.request.safeParse(args);
  if (!parsed.success) throw new Error(`request invalid: ${JSON.stringify(parsed.error.issues)}`);
  const out = await def.handler(ctx, parsed.data);
  const checked = def.response.safeParse(out);
  if (!checked.success) throw new Error(`response invalid: ${JSON.stringify(checked.error.issues)}`);
  return checked.data;
};

try {
  // Auth: register + login, incl. the digit-shape tolerance.
  const reg = await call("register", {
    name: "اختبار",
    email: "test@example.com",
    phone: "01012345678",
    password: "1234",
  });
  check("register", reg.ok === true && !!reg.token, `user id=${reg.user?.id}`);
  const token = reg.token;

  const login = await call("login", { identifier: "test@example.com", password: "1234" });
  check("login (same password)", login.ok === true && !!login.token);
  const loginAr = await call("login", { identifier: "test@example.com", password: "١٢٣٤" });
  check("login (Arabic-Indic digits)", loginAr.ok === true);
  const bad = await call("login", { identifier: "test@example.com", password: "9999" });
  check("login (wrong password rejected)", bad.ok === false);

  // Register auto-seeds the first account (86 Elkheta replies), so
  // the starter pack has nothing left to add.
  const list0 = await call("listShortcuts", { token });
  check("register auto-seeds first account", list0.shortcuts.length === 86, `n=${list0.shortcuts.length}`);
  const seed = await call("loadStarterPack", { token });
  check("loadStarterPack (already seeded)", seed.seeded === 0, `seeded=${seed.seeded}`);
  const folders0 = await call("listFolders", { token });
  check("ensureFolders rebuilt folders from categories", folders0.folders.length > 0, `n=${folders0.folders.length}`);

  // CRUD on a reply.
  const created = await call("createShortcut", {
    token, title: "رد اختبار", body: "نص الرد", category: "ترحيب", tags: "اختبار", extShortcut: "", source: "Chatwoot",
  });
  check("createShortcut", !!created.shortcut?.id, `id=${created.shortcut?.id}`);
  const sid = created.shortcut.id;
  const upd = await call("updateShortcut", {
    token, id: sid, title: "رد اختبار معدل", body: "نص الرد", category: "ترحيب", tags: "اختبار", extShortcut: "", source: "Chatwoot",
  });
  const afterUpd = await call("listShortcuts", { token });
  check("updateShortcut", upd.ok === true && afterUpd.shortcuts.find((s) => s.id === sid)?.title === "رد اختبار معدل");
  await call("toggleFavorite", { token, id: sid, favorite: true });
  const fav = await call("listShortcuts", { token });
  check("toggleFavorite", fav.shortcuts.find((s) => s.id === sid)?.favorite === true);
  await call("recordUse", { token, id: sid });
  const hist = await call("listCopyHistory", { token });
  check("recordUse + listCopyHistory", hist.entries.length === 1 && hist.entries[0].title === "رد اختبار معدل");

  // Folders.
  const folder = await call("createFolder", { token, name: "مجلد اختبار" });
  check("createFolder", !!folder.folder?.id, `id=${folder.folder?.id}`);
  // Folder icon colours (v91): named key stored as-is, custom hex
  // lowercased, anything else stored as null (automatic).
  const folderColor = await call("createFolder", { token, name: "مجلد ملون", iconColor: "royal" });
  check("createFolder iconColor (named key)", folderColor.folder?.iconColor === "royal", `iconColor=${folderColor.folder?.iconColor}`);
  const folderHex = await call("createFolder", { token, name: "مجلد ملون hex", iconColor: "#12AB34" });
  check("createFolder iconColor (custom hex lowercased)", folderHex.folder?.iconColor === "#12ab34", `iconColor=${folderHex.folder?.iconColor}`);
  const folderBad = await call("createFolder", { token, name: "مجلد لون غلط", iconColor: "not-a-color" });
  check("createFolder iconColor (invalid -> null)", folderBad.folder?.iconColor === null, `iconColor=${folderBad.folder?.iconColor}`);
  await call("renameFolder", { token, id: folder.folder.id, name: "مجلد اختبار", iconColor: "emerald" });
  const foldersAfter = await call("listFolders", { token });
  check("renameFolder iconColor", foldersAfter.folders.find((f) => f.id === folder.folder.id)?.iconColor === "emerald");
  const smartColor = await call("createSmartFolder", { token, name: "مجلد ذكي ملون", tags: "", iconColor: "rose" });
  check("createSmartFolder iconColor", smartColor.smartFolder?.iconColor === "rose", `iconColor=${smartColor.smartFolder?.iconColor}`);
  const moved = await call("moveShortcut", { token, id: sid, targetFolderId: folder.folder.id, orderedIds: [sid] });
  check("moveShortcut", moved.ok === true);

  // Trash + restore.
  await call("deleteShortcut", { token, id: sid });
  const trash = await call("listTrash", { token });
  check("deleteShortcut -> trash", trash.shortcuts.some((s) => s.id === sid));
  await call("restoreShortcut", { token, id: sid });
  const trash2 = await call("listTrash", { token });
  check("restoreShortcut", !trash2.shortcuts.some((s) => s.id === sid));

  // Avatar (in-memory blob stub here; bytes land in avatar_blobs on Neon).
  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const av = await call("setAvatar", { token, dataBase64: tinyPng.toString("base64"), mimeType: "image/png" });
  check("setAvatar", (av.user?.avatarUrl ?? "").startsWith("/api/avatar/"), av.user?.avatarUrl ?? "");
  const me = await call("me", { token });
  check("me returns avatarUrl", (me.user?.avatarUrl ?? "").startsWith("/api/avatar/"));
  await call("removeAvatar", { token });
  const me2 = await call("me", { token });
  check("removeAvatar", me2.user?.avatarUrl === null);

  // Import dedupe (same rule as the site's JSON import).
  const imp = await call("importShortcuts", {
    token,
    items: [
      { title: "رد اختبار معدل", body: "نص الرد", category: "ترحيب" },
      { title: "رد جديد", body: "نص جديد", category: "عام" },
    ],
    mode: "merge",
  });
  check("importShortcuts dedupe", imp.imported === 1 && imp.skipped === 1, `imported=${imp.imported} skipped=${imp.skipped}`);

  // Owner-only usage reset (v73): clears the whole copy history and
  // zeroes every reply's usage counter + last-used stamp. Runs here,
  // after the history checks above and before logout (it needs a
  // live owner token).
  const reset = await call("resetUsageStats", { token });
  check("resetUsageStats", reset.ok === true && reset.clearedHistory === 1 && reset.resetReplies === 1, `cleared=${reset.clearedHistory} reset=${reset.resetReplies}`);
  const histAfter = await call("listCopyHistory", { token });
  check("resetUsageStats clears history", histAfter.entries.length === 0);
  const listAfterReset = await call("listShortcuts", { token });
  check("resetUsageStats zeroes usage", listAfterReset.shortcuts.every((s) => s.usageCount === 0));

  // Sessions: logout ends the token (me then returns user: null,
  // which is how the client knows it is signed out).
  await call("logout", { token });
  const meAfter = await call("me", { token });
  check("logout invalidates token", meAfter.user === null);
} catch (e) {
  console.log(`ERROR: ${e.stack ?? e.message}`);
  results.push({ name: "uncaught", ok: false, detail: String(e.message) });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
