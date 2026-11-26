/* Test-only end-to-end check of reply media (IMAGES ONLY — video
   was cancelled by the owner 2026-11-26; replies, Vercel Blob
   references) against pg-mem (an in-memory
   Postgres emulator — no real Neon instance is available in this
   VM). It applies drizzle/0001_init.sql, then exercises the
   handlers exactly as /api/actions would call them:
   attach/remove with server-side re-validation (ownership, kind /
   content-type pair, size caps, pathname shape, Blob host),
   listShortcuts / listTrash joins, duplicate shares the Blob
   object (refcount guard), unique-shortcut + case-insensitive
   trigger index, cascade on permanent delete, starter library
   never copies media, full backup carries media URLs only.
   The real Blob del() is NOT exercised here: with no
   BLOB_READ_WRITE_TOKEN it throws BlobAccessError at once, which
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

const mediaRows = async () => (await pool.query("SELECT * FROM reply_media")).rows;
const mediaFor = async (sid) =>
  (await pool.query("SELECT * FROM reply_media WHERE shortcut_id = $1", [sid])).rows[0] ?? null;

const BLOB_HOST = "store123.public.blob.vercel-storage.com";
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

  // ---- attach: happy path.
  const attached = await call("attachMedia", imgArgs(tokenA, sid, uidA));
  check(
    "attachMedia image",
    attached.media?.kind === "image" &&
      attached.media.blobPathname === `media/${uidA}/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`,
    attached.media?.blobUrl ?? "",
  );
  const list1 = await call("listShortcuts", { token: tokenA });
  const mine = list1.shortcuts.find((s) => s.id === sid);
  check("listShortcuts joins media", mine?.media?.kind === "image");
  check(
    "listShortcuts leaves other replies media-less",
    list1.shortcuts.filter((s) => s.id !== sid).every((s) => s.media === null),
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

  // ---- replace: a second image over the first (old row replaced, not doubled).
  const replaced = await call("attachMedia", {
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
  check("attachMedia replaces image with image", replaced.media?.kind === "image");
  check("replace keeps one media row", (await mediaRows()).length === 1);

  // ---- remove: ownership + happy path.
  const errRemove = await callThrows("removeMedia", { token: tokenB, shortcutId: sid });
  check("removeMedia rejects other user", !!errRemove, errRemove ?? "");
  await call("removeMedia", { token: tokenA, shortcutId: sid });
  check("removeMedia deletes the row", (await mediaFor(sid)) === null);
  const list2 = await call("listShortcuts", { token: tokenA });
  check("listShortcuts media null after remove", list2.shortcuts.find((s) => s.id === sid)?.media === null);
  const errRemoveEmpty = await callThrows("removeMedia", { token: tokenA, shortcutId: sid });
  check("removeMedia on media-less reply throws", !!errRemoveEmpty, errRemoveEmpty ?? "");

  // ---- duplicate shares the Blob object; the refcount guard keeps
  // it alive while either copy still points at it (DB-visible: the
  // surviving row still references the pathname after the copy's
  // media is removed).
  await call("attachMedia", imgArgs(tokenA, sid, uidA));
  const dup = await call("duplicateShortcut", { token: tokenA, id: sid });
  const copyId = dup.shortcut.id;
  check("duplicateShortcut copies media", dup.shortcut.media?.blobPathname === `media/${uidA}/${sid}/aaaaaaaa-1111-2222-3333-444444444444.jpg`, `copy id=${copyId}`);
  check("duplicate shares the pathname (no re-upload)", (await mediaRows()).length === 2);
  await call("removeMedia", { token: tokenA, shortcutId: copyId });
  const stillThere = await mediaFor(sid);
  check("refcount guard: original keeps media after copy removed", stillThere !== null);

  // ---- unique shortcut_id: a second media row for one reply cannot exist.
  let uniqueErr = null;
  try {
    await pool.query(
      "INSERT INTO reply_media (shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size) VALUES ($1,$2,'image','https://x','media/1/2/z.jpg','image/jpeg',10)",
      [sid, uidA],
    );
  } catch (e) {
    uniqueErr = e instanceof Error ? e.message : String(e);
  }
  check("unique index on reply_media.shortcut_id", !!uniqueErr, uniqueErr ?? "");

  // ---- trash shows media; permanent delete cascades the media row.
  await call("deleteShortcut", { token: tokenA, id: sid });
  const trash = await call("listTrash", { token: tokenA });
  check(
    "listTrash joins media",
    trash.shortcuts.find((s) => s.id === sid)?.media?.kind === "image",
  );
  await call("deleteShortcutForever", { token: tokenA, id: sid });
  check("permanent delete cascades media row", (await mediaFor(sid)) === null);

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
  check("starter seed does NOT copy media", seededCopy?.media === null);

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
