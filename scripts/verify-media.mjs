/* Test-only end-to-end check of reply media (IMAGES ONLY — video
   was cancelled by the owner 2026-11-26; replies, Vercel Blob
   references) against pg-mem (an in-memory
   Postgres emulator — no real Neon instance is available in this
   VM). It applies drizzle/0001_init.sql, then exercises the
   handlers exactly as /api/actions would call them:
   attach/remove with server-side re-validation (ownership, kind /
   content-type pair, size caps, pathname shape, Blob host),
   UP TO 3 images per reply (2026-11-27 — attach 1/2/3, reject a
   4th server-side, remove ONE image by mediaId, replace = remove
   + attach), listShortcuts / listTrash joins return ordered
   media arrays, duplicate shares the Blob objects (refcount
   guard), unique-shortcut + case-insensitive trigger index,
   cascade on permanent delete, starter library never copies
   media, full backup carries media URLs only (with position).
   The real Blob del() is NOT exercised here: with no Blob token
   configured (neither PUBLIC_BLOB_READ_WRITE_TOKEN nor
   BLOB_READ_WRITE_TOKEN) it throws BlobAccessError at once, which
   the handlers catch and log (same tolerance as removeAvatar) —
   live verification must confirm Blob objects disappear (the URL
   404s) after a permanent delete.
   Usage: node scripts/verify-media.mjs */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/pg-proxy";
import { Actions } from "../lib/actions.ts";
import * as schema from "../lib/schema.ts";
import {
  BLOB_API_URL,
  BLOB_API_VERSION,
  blobPutUrl,
  classifyUploadError,
  parseStoreIdFromClientToken,
  uploadErrorMessage,
} from "../components/media-upload.ts";
import { blobReadWriteToken } from "../lib/blob-token.ts";

const root = join(import.meta.dirname, "..");
const mem = newDb();
const ddl = readFileSync(join(root, "drizzle", "0001_init.sql"), "utf-8");
await mem.public.none(ddl);
console.log("DDL applied to pg-mem.");


// Same pg-proxy driver setup as scripts/verify-actions.mjs (see its
// header for the two pg-mem quirks this works around).
const { Pool } = mem.adapters.createPg();
const pool = new Pool();

// The init file no longer creates shortcuts_user_trigger_idx (Round 4
// deploy fix: it is applied as one multi-statement query before the
// guarded step, so an index there would abort the whole Vercel build
// on live duplicate triggers). The guarded step in scripts/setup-db.ts
// creates it — run the same step here (verbatim queries) so the DB
// under test matches what the production build creates.
const { rows: dupTriggers } = await pool.query(`
    SELECT user_id, t, n FROM (
      SELECT user_id, lower(trigger) AS t, COUNT(*)::int AS n
      FROM shortcuts
      WHERE trigger <> '' AND deleted_at IS NULL
      GROUP BY user_id, lower(trigger)
    ) dups WHERE n > 1`);
if (dupTriggers.length > 0) {
  throw new Error(`guarded trigger-index step skipped in test setup: ${JSON.stringify(dupTriggers)}`);
}
await pool.query(`DROP INDEX IF EXISTS shortcuts_user_trigger_idx`);
await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS shortcuts_user_trigger_idx
        ON shortcuts(user_id, lower(trigger))
        WHERE trigger <> '' AND deleted_at IS NULL`);
console.log("Guarded trigger-index step applied (as in scripts/setup-db.ts).");
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

const mediaRows = async () => (await pool.query("SELECT * FROM reply_media")).rows;
const mediaFor = async (sid) =>
  (await pool.query("SELECT * FROM reply_media WHERE shortcut_id = $1", [sid])).rows[0] ?? null;
const mediaListFor = async (sid) =>
  (await pool.query("SELECT * FROM reply_media WHERE shortcut_id = $1 ORDER BY position ASC", [sid])).rows;

const BLOB_HOST = "store123.public.blob.vercel-storage.com";

// Blob token lookup (lib/blob-token.ts): the Public store's
// PUBLIC_BLOB_READ_WRITE_TOKEN wins over the legacy
// BLOB_READ_WRITE_TOKEN (which still points at the old Private
// store); undefined when neither is set. Env is restored after.
const savedPublicToken = process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;
const savedLegacyToken = process.env.BLOB_READ_WRITE_TOKEN;
process.env.PUBLIC_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_public_test";
process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_legacy_test";
check(
  "blob token prefers PUBLIC_BLOB_READ_WRITE_TOKEN",
  blobReadWriteToken() === "vercel_blob_rw_public_test",
);
delete process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;
check(
  "blob token falls back to BLOB_READ_WRITE_TOKEN",
  blobReadWriteToken() === "vercel_blob_rw_legacy_test",
);
delete process.env.BLOB_READ_WRITE_TOKEN;
check(
  "blob token undefined when neither is set",
  blobReadWriteToken() === undefined,
);
if (savedPublicToken !== undefined)
  process.env.PUBLIC_BLOB_READ_WRITE_TOKEN = savedPublicToken;
if (savedLegacyToken !== undefined)
  process.env.BLOB_READ_WRITE_TOKEN = savedLegacyToken;

const imgArgs = (token, sid, uid, extra = {}) => ({
  token,
  shortcutId: sid,
  kind: "image",
  blobUrl: `https://${BLOB_HOST}/media/${uid}/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
  blobPathname: `media/${uid}/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
  contentType: "image/jpeg",
  byteSize: 123456,
  width: 1600,
  height: 900,
  ...extra,
});

try {
  // ---- accounts: owner A (auto-seeded), second user B.
  const regA = await call("register", {
    name: "اختبار",
    email: "a@example.com",
    phone: "01012345678",
    password: "1234",
  });
  check("register owner", regA.ok === true && !!regA.token, `user id=${regA.user?.id}`);
  const tokenA = regA.token;
  const uidA = regA.user.id;
  const regB = await call("register", {
    name: "تاني",
    email: "b@example.com",
    phone: "01098765432",
    password: "1234",
  });
  check("register second user", regB.ok === true && !!regB.token, `user id=${regB.user?.id}`);
  const tokenB = regB.token;

  // ---- the test reply: «تيست», the only reply media ever touches.
  const created = await call("createShortcut", {
    token: tokenA, title: "تيست", body: "نص تجريبي", category: "ترحيب",
  });
  const sid = created.shortcut.id;
  check("createShortcut تيست", !!sid, `id=${sid}`);

  // ---- attach: happy path (image 1 of up to 3).
  const attached = await call("attachMedia", imgArgs(tokenA, sid, uidA));
  check(
    "attachMedia image",
    attached.media?.kind === "image" &&
      attached.media.position === 1 &&
      attached.media.blobPathname === `media/${uidA}/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
    attached.media?.blobUrl ?? "",
  );
  const list1 = await call("listShortcuts", { token: tokenA });
  const mine = list1.shortcuts.find((s) => s.id === sid);
  check(
    "listShortcuts joins media as an ordered array",
    Array.isArray(mine?.media) && mine.media.length === 1 && mine.media[0].kind === "image" && mine.media[0].position === 1,
    JSON.stringify(mine?.media),
  );
  check(
    "listShortcuts leaves other replies media-less (empty array)",
    list1.shortcuts.filter((s) => s.id !== sid).every((s) => Array.isArray(s.media) && s.media.length === 0),
  );

  // ---- attach: server-side re-validation (every one must throw).
  const errOwner = await callThrows("attachMedia", imgArgs(tokenB, sid, uidA));
  check("attachMedia rejects other user's reply", !!errOwner, errOwner ?? "");
  const errType = await callThrows(
    "attachMedia",
    imgArgs(tokenA, sid, uidA, { contentType: "video/mp4" }),
  );
  check("attachMedia rejects kind/content-type mismatch", !!errType, errType ?? "");
  const errSize = await callThrows(
    "attachMedia",
    imgArgs(tokenA, sid, uidA, { byteSize: 9 * 1024 * 1024 }),
  );
  check("attachMedia rejects oversize image", !!errSize, errSize ?? "");
  const errPath = await callThrows(
    "attachMedia",
    imgArgs(tokenA, sid, uidA, {
      blobPathname: `media/999/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
      blobUrl: `https://${BLOB_HOST}/media/999/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
    }),
  );
  check("attachMedia rejects foreign pathname", !!errPath, errPath ?? "");
  const errHost = await callThrows(
    "attachMedia",
    imgArgs(tokenA, sid, uidA, { blobUrl: "https://evil.example.com/x.jpg" }),
  );
  check("attachMedia rejects non-Blob host", !!errHost, errHost ?? "");
  const errVideoKind = await callThrows("attachMedia", {
    token: tokenA,
    shortcutId: sid,
    kind: "video",
    blobUrl: `https://${BLOB_HOST}/media/${uidA}/${sid}/bbbbbbbb-1111-2222-3333-444444444444.png`,
    blobPathname: `media/${uidA}/${sid}/bbbbbbbb-1111-2222-3333-444444444444.png`,
    contentType: "image/png",
    byteSize: 100000,
    width: 1280,
    height: 720,
  });
  check("attachMedia rejects kind video (images only)", !!errVideoKind, errVideoKind ?? "");

  // ---- multi-image (2026-11-27): attach 2nd and 3rd (append,
  // positions 2 and 3), then a 4th is refused server-side.
  const second = await call("attachMedia", {
    token: tokenA,
    shortcutId: sid,
    kind: "image",
    blobUrl: `https://${BLOB_HOST}/media/${uidA}/${sid}/bbbbbbbb-1111-2222-3333-444444444444.png`,
    blobPathname: `media/${uidA}/${sid}/bbbbbbbb-1111-2222-3333-444444444444.png`,
    contentType: "image/png",
    byteSize: 100000,
    width: 1280,
    height: 720,
  });
  check("attachMedia 2nd image takes position 2", second.media?.position === 2 && second.media?.kind === "image");
  const third = await call("attachMedia", {
    token: tokenA,
    shortcutId: sid,
    kind: "image",
    blobUrl: `https://${BLOB_HOST}/media/${uidA}/${sid}/cccccccc-1111-2222-3333-444444444444.webp`,
    blobPathname: `media/${uidA}/${sid}/cccccccc-1111-2222-3333-444444444444.webp`,
    contentType: "image/webp",
    byteSize: 90000,
    width: 1200,
    height: 800,
  });
  check("attachMedia 3rd image takes position 3", third.media?.position === 3);
  check("three media rows for one reply", (await mediaRows()).length === 3);
  const errFourth = await callThrows("attachMedia", {
    token: tokenA,
    shortcutId: sid,
    kind: "image",
    blobUrl: `https://${BLOB_HOST}/media/${uidA}/${sid}/dddddddd-1111-2222-3333-444444444444.jpg`,
    blobPathname: `media/${uidA}/${sid}/dddddddd-1111-2222-3333-444444444444.jpg`,
    contentType: "image/jpeg",
    byteSize: 80000,
    width: 1000,
    height: 600,
  });
  check("attachMedia rejects a 4th image", !!errFourth && errFourth.includes("3 صور"), errFourth ?? "");
  const list3 = await call("listShortcuts", { token: tokenA });
  const mine3 = list3.shortcuts.find((s) => s.id === sid);
  check(
    "listShortcuts returns all 3 images ordered by position",
    Array.isArray(mine3?.media) &&
      mine3.media.length === 3 &&
      mine3.media.map((m) => m.position).join(",") === "1,2,3",
    JSON.stringify(mine3?.media?.map((m) => m.position)),
  );

  // ---- remove ONE image by mediaId: only that row goes; the
  // other two keep their order. Then "replace" = remove + attach
  // (the new image takes max position + 1).
  const rowsBefore = await mediaListFor(sid);
  const middleId = rowsBefore[1].id;
  const errRemove = await callThrows("removeMedia", { token: tokenB, shortcutId: sid, mediaId: middleId });
  check("removeMedia rejects other user", !!errRemove, errRemove ?? "");
  await call("removeMedia", { token: tokenA, shortcutId: sid, mediaId: middleId });
  const rowsAfterRemove = await mediaListFor(sid);
  check(
    "removeMedia deletes only that image",
    rowsAfterRemove.length === 2 && rowsAfterRemove.every((r) => r.id !== middleId),
    `rows=${rowsAfterRemove.length}`,
  );
  check(
    "removeMedia keeps the other images in order",
    rowsAfterRemove.map((r) => r.position).join(",") === "1,3",
    rowsAfterRemove.map((r) => r.position).join(","),
  );
  const replacement = await call("attachMedia", {
    token: tokenA,
    shortcutId: sid,
    kind: "image",
    blobUrl: `https://${BLOB_HOST}/media/${uidA}/${sid}/dddddddd-1111-2222-3333-444444444444.jpg`,
    blobPathname: `media/${uidA}/${sid}/dddddddd-1111-2222-3333-444444444444.jpg`,
    contentType: "image/jpeg",
    byteSize: 80000,
    width: 1000,
    height: 600,
  });
  check(
    "replace: new image after a removal takes max position + 1",
    replacement.media?.position === 4 && (await mediaListFor(sid)).length === 3,
    `position=${replacement.media?.position}`,
  );
  const errRemoveGone = await callThrows("removeMedia", { token: tokenA, shortcutId: sid, mediaId: middleId });
  check("removeMedia on a missing image throws", !!errRemoveGone, errRemoveGone ?? "");
  // Remove the replacement too, so the reply is back to 2 images
  // for the duplicate test below.
  await call("removeMedia", { token: tokenA, shortcutId: sid, mediaId: replacement.media.id });
  check("reply back to 2 images after cleanup", (await mediaListFor(sid)).length === 2);
  const list2 = await call("listShortcuts", { token: tokenA });
  check(
    "listShortcuts media array after removes",
    (list2.shortcuts.find((s) => s.id === sid)?.media ?? []).length === 2,
  );

  // ---- duplicate shares the Blob objects; the refcount guard keeps
  // them alive while either copy still points at them (DB-visible:
  // the surviving rows still reference the pathnames after the
  // copy's media is removed).
  const rowsBeforeDup = await mediaListFor(sid);
  const dup = await call("duplicateShortcut", { token: tokenA, id: sid });
  const copyId = dup.shortcut.id;
  check(
    "duplicateShortcut copies ALL media rows with positions",
    Array.isArray(dup.shortcut.media) &&
      dup.shortcut.media.length === rowsBeforeDup.length &&
      dup.shortcut.media.map((m) => m.position).join(",") === rowsBeforeDup.map((r) => r.position).join(","),
    `copy id=${copyId} media=${dup.shortcut.media?.length}`,
  );
  check(
    "duplicate shares the pathnames (no re-upload)",
    Array.isArray(dup.shortcut.media) &&
      dup.shortcut.media.every((m) => rowsBeforeDup.some((r) => r.blob_pathname === m.blobPathname)),
  );
  check(
    "duplicate returns the COPY's media ids (not the source's)",
    Array.isArray(dup.shortcut.media) &&
      dup.shortcut.media.every((m) => !rowsBeforeDup.some((r) => r.id === m.id)),
    `copy ids=${dup.shortcut.media?.map((m) => m.id).join(",")} source ids=${rowsBeforeDup.map((r) => r.id).join(",")}`,
  );
  const copyMediaId = dup.shortcut.media[0].id;
  await call("removeMedia", { token: tokenA, shortcutId: copyId, mediaId: copyMediaId });
  const stillThere = await mediaListFor(sid);
  check(
    "refcount guard: original keeps all media after copy's image removed",
    stillThere.length === rowsBeforeDup.length,
    `rows=${stillThere.length}`,
  );

  // ---- the old one-row-per-reply uniqueness is gone: several
  // rows per reply coexist (the (shortcut_id, position) index is
  // a lookup index, not a uniqueness constraint).
  const extra = await pool.query(
    "INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, position) VALUES ($1,$2,'image','https://x','media/1/2/z.jpg','image/jpeg',10, 9) RETURNING id",
    [sid, uidA],
  );
  check("a second media row for one reply can exist (multi-image)", extra.rows.length === 1, `rows=${extra.rows.length}`);
  await pool.query("DELETE FROM reply_media WHERE id = $1", [extra.rows[0].id]);

  // ---- trash shows media; permanent delete cascades the media rows.
  await call("deleteShortcut", { token: tokenA, id: sid });
  const trash = await call("listTrash", { token: tokenA });
  check(
    "listTrash joins media as an ordered array",
    (() => {
      const m = trash.shortcuts.find((s) => s.id === sid)?.media;
      return Array.isArray(m) && m.length === 2 && m.every((x) => x.kind === "image");
    })(),
  );
  await call("deleteShortcutForever", { token: tokenA, id: sid });
  check("permanent delete cascades media rows", (await mediaListFor(sid)).length === 0);

  // ---- case-insensitive trigger uniqueness at the DB level:
  // the server check rejects "salam" after "Salam", and a raw
  // insert of "SALAM" trips the lower() unique index.
  const t1 = await call("createShortcut", {
    token: tokenA, title: "رد سلام", body: "ب", category: "ترحيب", trigger: "Salam",
  });
  check("createShortcut trigger Salam", !!t1.shortcut?.id);
  const errDupTrig = await callThrows("createShortcut", {
    token: tokenA, title: "رد سلام 2", body: "ب", category: "ترحيب", trigger: "salam",
  });
  check("server rejects case-insensitive duplicate trigger", !!errDupTrig, errDupTrig ?? "");
  let idxErr = null;
  try {
    await pool.query(
      "INSERT INTO shortcuts (user_id, title, body, category, trigger) VALUES ($1,'x','y','عام','SALAM')",
      [uidA],
    );
  } catch (e) {
    idxErr = e instanceof Error ? e.message : String(e);
  }
  check("lower() unique index rejects SALAM", !!idxErr, idxErr ?? "");

  // ---- starter library never copies media.
  const withMedia = await call("createShortcut", {
    token: tokenA, title: "رد بالوسائط", body: "نص", category: "ترحيب",
  });
  const wmId = withMedia.shortcut.id;
  await call("attachMedia", imgArgs(tokenA, wmId, uidA));
  const setLib = await call("setStarterLibrary", { token: tokenA, shortcutIds: [wmId] });
  check("setStarterLibrary saves 1", setLib.saved === 1);
  const regC = await call("register", {
    name: "تالت",
    email: "c@example.com",
    phone: "01011112222",
    password: "1234",
  });
  const listC = await call("listShortcuts", { token: regC.token });
  const seededCopy = listC.shortcuts.find((s) => s.title === "رد بالوسائط");
  check("starter seed copies the reply", !!seededCopy);
  check("starter seed does NOT copy media", Array.isArray(seededCopy?.media) && seededCopy.media.length === 0);

  // ---- full backup carries media URLs only (no bytes).
  const full = await call("exportFullBackup", { token: tokenA });
  const data = JSON.parse(full.json);
  check(
    "exportFullBackup includes media",
    Array.isArray(data.media) &&
      data.media.some((m) => m.shortcutId === wmId && m.kind === "image"),
    `media rows=${data.media?.length ?? 0}`,
  );
  check(
    "exportFullBackup media has URLs, no bytes",
    data.media.every((m) => typeof m.blobUrl === "string" && !("dataBase64" in m) && !("bytes" in m)),
  );
  check(
    "exportFullBackup media rows carry position",
    data.media.every((m) => typeof m.position === "number"),
    `positions=${data.media.map((m) => m.position).join(",")}`,
  );

  // ---- emptyTrash cleans media rows of trashed replies.
  await call("deleteShortcut", { token: tokenA, id: wmId });
  const before = (await mediaFor(wmId)) !== null;
  const emptied = await call("emptyTrash", { token: tokenA });
  check("emptyTrash removes trashed reply", emptied.removed >= 1 && before, `removed=${emptied.removed}`);
  check("emptyTrash cascades media row", (await mediaFor(wmId)) === null);
  // ---- upload helpers (components/media-upload.ts): the pure
  // part of the 2026-11-26 upload fix — token parsing, error
  // classification and the distinct Arabic messages. The browser
  // steps (preflight, timeout/watchdog, XHR fallback, server
  // proxy) must be verified live; this proves the decisions.
  check(
    "parseStoreIdFromClientToken",
    parseStoreIdFromClientToken("vercel_blob_client_abc123def456_AAAA") === "abc123def456",
    parseStoreIdFromClientToken("vercel_blob_client_abc123def456_AAAA") ?? "null",
  );
  check("parseStoreIdFromClientToken garbage", parseStoreIdFromClientToken("nope") === null);
  check("parseStoreIdFromClientToken empty", parseStoreIdFromClientToken("") === null);
  check(
    "blobPutUrl encodes pathname",
    blobPutUrl("media/1/2/a b.png") === `${BLOB_API_URL}/?pathname=media%2F1%2F2%2Fa+b.png`,
    blobPutUrl("media/1/2/a b.png"),
  );
  check("BLOB_API_VERSION", BLOB_API_VERSION === "13");
  const abortErr = new DOMException("The user aborted a request.", "AbortError");
  check("classify AbortError", classifyUploadError(abortErr) === "aborted");
  check("classify token expired", classifyUploadError(new Error("Vercel Blob: Client token has expired.")) === "token-expired");
  check("classify content-type", classifyUploadError(new Error("Vercel Blob: Content type mismatch, image/gif is not allowed.")) === "content-type");
  check("classify too large", classifyUploadError(new Error("Vercel Blob: File is too large, the file length cannot be greater than 8388608.")) === "too-large");
  check("classify token mint", classifyUploadError(new Error("Vercel Blob: Failed to retrieve the client token")) === "token");
  check("classify store missing", classifyUploadError(new Error("Vercel Blob: This store does not exist.")) === "not-found");
  check("classify forbidden", classifyUploadError(new Error("Vercel Blob: Access denied, please provide a valid token for this resource.")) === "forbidden");
  check("classify service", classifyUploadError(new Error("Vercel Blob: The blob service is currently not available. Please try again.")) === "service");
  check("classify network", classifyUploadError(new TypeError("Failed to fetch")) === "network");
  check("classify network 2", classifyUploadError(new TypeError("Network request failed")) === "network");
  check("classify unknown", classifyUploadError(new Error("something else")) === "unknown");
  check("classify non-Error", classifyUploadError("Failed to fetch") === "network");
  const kinds = ["aborted", "stalled", "unreachable", "network", "token", "token-expired", "content-type", "too-large", "forbidden", "not-found", "service", "unknown"];
  const msgs = new Set();
  let allArabic = true;
  for (const k of kinds) {
    const m = uploadErrorMessage(k);
    if (!m || !/[\u0600-\u06FF]/.test(m)) allArabic = false;
    msgs.add(m);
  }
  check("uploadErrorMessage: every kind has a distinct Arabic message", allArabic && msgs.size === kinds.length, `${msgs.size} distinct of ${kinds.length}`);
  check(
    "uploadErrorMessage stalled vs aborted differ",
    uploadErrorMessage("stalled") !== uploadErrorMessage("aborted"),
  );
  // ---- upload diagnostics (2026-11-26): one failure, one diagnosis ----
  check(
    "classify maps XHR 403 to forbidden (was: generic unknown)",
    classifyUploadError(new Error("Blob upload failed (403)")) === "forbidden",
  );
  check(
    "classify maps XHR 404 to not-found",
    classifyUploadError(new Error("Blob upload failed (404)")) === "not-found",
  );
  check(
    "classify maps XHR 429/500 to service",
    classifyUploadError(new Error("Blob upload failed (429)")) === "service" &&
      classifyUploadError(new Error("server upload failed (HTTP 500)")) === "service",
  );
  check(
    "classify maps an XHR error carrying the API code to forbidden",
    classifyUploadError(new Error("Access denied — code: forbidden — HTTP 403")) === "forbidden",
  );
  const editorSrc = readFileSync(join(root, "components", "modals", "EditorModal.tsx"), "utf8");
  const stages = ["التحقق من الملف", "فحص الاتصال", "تجهيز الملف", "تجهيز الرفع", "الرفع المباشر", "الرفع البديل", "الرفع من السيرفر", "حفظ الوسائط"];
  check(
    "editor tracks all 8 upload stages",
    stages.every((s) => editorSrc.includes(`"${s}"`)),
    stages.filter((s) => !editorSrc.includes(`"${s}"`)).join(", "),
  );
  check(
    "editor appends the stage to every upload error (withStage)",
    /const withStage = \(m: string\) => `\$\{m\} — المرحلة: \$\{stage\}`;/.test(editorSrc) &&
      /setMediaError\(withStage\(base\)\);/.test(editorSrc),
  );
  check(
    "failures surface a SPECIFIC classified cause before the generic line",
    /else if \(\s*classified === "content-type"/.test(editorSrc),
  );
  check(
    "editor has no video fallback line left (video cancelled)",
    !editorSrc.includes("الفيديو مش راضي يترفع") &&
      !editorSrc.includes('kind === "video"') &&
      !editorSrc.includes("measureVideo"),
  );
  // ---- cap-error clearing (Round 5, 2026-11-27): the «3 صور
  // بالفعل» error used to stay visible after an image was
  // removed and the count dropped below 3. The cap error is
  // only true while the list is full, so an effect clears it
  // the moment mediaList.length drops under the cap.
  check(
    "cap error clears when the image count drops below 3",
    /mediaList\.length < MAX_IMAGES_PER_REPLY && mediaError === MEDIA_CAP_ERROR/.test(editorSrc) &&
      /if \(mediaList\.length >= MAX_IMAGES_PER_REPLY\) \{\s*setMediaError\(MEDIA_CAP_ERROR\);/.test(editorSrc),
  );
  // ---- upload diagnosability (2026-11-26): the server fallback
  // used to throw a bare message with no cause, so the UI showed
  // a bare «الرفع متمّش» at stage «الرفع من السيرفر». The error
  // must now carry the HTTP status + Blob code, and the mint must
  // retry once with a freshly re-read session token.
  const mediaUploadSrc = readFileSync(join(root, "components", "media-upload.ts"), "utf8");
  check(
    "uploadViaServer appends the HTTP status to thrown errors",
    mediaUploadSrc.includes("(HTTP ${res.status})"),
  );
  check(
    "classify maps HTTP 401 to token (mint session errors)",
    classifyUploadError(new Error("انتهت الجلسة (HTTP 401)")) === "token",
  );
  check(
    "mintClientToken retries once with the stored session token",
    mediaUploadSrc.includes("readStoredSessionToken") &&
      mediaUploadSrc.includes("انتهت الجلسة"),
  );
  check(
    "upload-direct route answers put() failures with status + code",
    readFileSync(join(root, "app", "api", "media", "upload-direct", "route.ts"), "utf8").includes("blob_put_failed"),
  );

} catch (e) {
  console.log(`ERROR: ${e.stack ?? e.message}`);
  fail++;
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
