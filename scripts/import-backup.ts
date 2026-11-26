/* Imports the library into Neon Postgres. Two modes:
 *
 * 1) Site JSON backup (what the live site downloads):
 *      node scripts/import-backup.ts --backup is-shortcuts-backup.json --user <email|phone|id>
 *    Imports the backup's replies into an EXISTING account (register
 *    on the new site first), deduped by title+body exactly like the
 *    site's own import. folder_id is left null on purpose: the
 *    ported ensureFolders() recreates the folders from the replies'
 *    categories on first load, exactly like the original.
 *    --mode replace deletes that user's replies first (needs --yes).
 *
 * 2) Full export (all tables, original ids, password hashes as-is):
 *      node scripts/import-backup.ts --full full-export.json
 *    Format: { users, folders, shortcuts, copyHistory, sessions,
 *    smartFolders, siteConfig, media: [{id, shortcutId, userId,
 *    kind, blobUrl, blobPathname, contentType, byteSize, width,
 *    height, durationMs, createdAt, updatedAt}],
 *    avatars: [{userId, mimeType,
 *    dataBase64}] }. Idempotent (ON CONFLICT DO NOTHING) and resets
 *    the id sequences afterwards. Media rows carry URLs only — the
 *    bytes stay in Vercel Blob; a URL that 404s at render time
 *    shows a "media unavailable" placeholder, never a crash.
 *
 * NOTE — what the site's JSON backup does and does NOT carry:
 * the backup file is { shortcuts: [{title, body, category, tags,
 * extShortcut, source}] } ONLY. It has no accounts, no password
 * hashes, no folder nesting/pins/descriptions/sources, no usage
 * counts, favorites, trash state, smart folders, copy history or
 * avatars. Those only come from a full export (mode 2). See README.
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/import-backup.ts ...
 * Add --dry-run to validate and print what would happen, without writing.
 */

import { readFileSync } from "node:fs";
import { Client } from "pg";

function usage(): never {
  console.error(
    "Usage:\n" +
      "  node scripts/import-backup.ts --backup <file> --user <email|phone|id> [--mode merge|replace] [--yes]\n" +
      "  node scripts/import-backup.ts --full <file>\n" +
      "  Add --dry-run to validate without writing. DATABASE_URL must be set.",
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string): boolean => argv.includes(name);

const backupFile = opt("--backup");
const fullFile = opt("--full");
if ((!backupFile && !fullFile) || (backupFile && fullFile)) usage();
if (backupFile && !opt("--user")) {
  console.error("--backup needs --user <email|phone|id> (the account must already exist).");
  process.exit(1);
}
const mode = opt("--mode") ?? "merge";
if (mode !== "merge" && mode !== "replace") {
  console.error('--mode must be "merge" or "replace".');
  process.exit(1);
}
if (mode === "replace" && !has("--yes")) {
  console.error("--mode replace deletes the user's current replies — re-run with --yes to confirm.");
  process.exit(1);
}
const dryRun = has("--dry-run");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const keyOf = (title: string, body: string) =>
  title.trim().toLowerCase() + "\n" + body.trim();

function normalizePhone(raw: string): string {
  let p = raw.replace(/[٠-٩۰-۹０-９]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x660 && code <= 0x669) return String(code - 0x660);
    if (code >= 0x6f0 && code <= 0x6f9) return String(code - 0x6f0);
    return String(code - 0xff10);
  }).replace(/[\s\-()]/g, "");
  if (p.startsWith("+20")) p = "0" + p.slice(3);
  else if (p.startsWith("0020")) p = "0" + p.slice(4);
  else if (p.startsWith("20") && p.length === 12) p = "0" + p.slice(2);
  return p;
}

const client = new Client({ connectionString });
await client.connect();
try {
  if (backupFile) {
    const parsed: unknown = JSON.parse(readFileSync(backupFile, "utf-8"));
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed as { shortcuts?: unknown }).shortcuts;
    if (!Array.isArray(arr)) throw new Error("backup file has no shortcuts array");
    const items = arr
      .filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null && typeof x.body === "string" && typeof x.title === "string",
      )
      .map((x) => ({
        title: typeof x.title === "string" && x.title ? x.title : "رد مستورد",
        body: x.body as string,
        category: typeof x.category === "string" && x.category ? x.category : "عام",
        tags: typeof x.tags === "string" ? x.tags : "",
        /* The reply's own expansion trigger — free-form text, any
           language, case or characters, kept exactly as written
           (only trimmed). A trigger is invalid only if it is empty
           or duplicates another of this user's triggers, which is
           checked against the live library below; a bad word in a
           backup file must never block the whole import. */
        trigger:
          typeof x.trigger === "string" ? x.trigger.trim() : "",
        extShortcut: typeof x.extShortcut === "string" ? x.extShortcut : "",
        source: typeof x.source === "string" ? x.source : "",
      }));
    if (items.length === 0) throw new Error("backup has no usable replies");

    const userArg = opt("--user") as string;
    const userRes = /^\d+$/.test(userArg)
      ? await client.query("SELECT id, email FROM users WHERE id = $1", [Number(userArg)])
      : userArg.includes("@")
        ? await client.query("SELECT id, email FROM users WHERE email = $1", [userArg.trim().toLowerCase()])
        : await client.query("SELECT id, email FROM users WHERE phone = $1", [normalizePhone(userArg)]);
    if (userRes.rows.length === 0) {
      console.error(
        `No account found for "${userArg}". Register that account on the new site first, then re-run.`,
      );
      process.exit(1);
    }
    const userId = userRes.rows[0].id as number;
    console.log(`Target account: id=${userId} (${userRes.rows[0].email ?? "no email"})`);
    console.log(`Backup replies: ${items.length} (mode=${mode}${dryRun ? ", dry-run" : ""})`);

    if (dryRun) {
      const existing = await client.query(
        "SELECT title, body FROM shortcuts WHERE user_id = $1",
        [userId],
      );
      const seen = new Set(existing.rows.map((r) => keyOf(r.title, r.body)));
      let wouldImport = 0;
      let wouldSkip = 0;
      for (const it of items) {
        if (seen.has(keyOf(it.title, it.body))) wouldSkip++;
        else {
          seen.add(keyOf(it.title, it.body));
          wouldImport++;
        }
      }
      console.log(`Would import ${wouldImport}, skip ${wouldSkip} duplicates.`);
      process.exit(0);
    }

    await client.query("BEGIN");
    try {
      if (mode === "replace") {
        await client.query("DELETE FROM shortcuts WHERE user_id = $1", [userId]);
      }
      const existing = await client.query(
        "SELECT title, body FROM shortcuts WHERE user_id = $1",
        [userId],
      );
      const seen = new Set(existing.rows.map((r) => keyOf(r.title, r.body)));
      /* Triggers already live in this library plus the ones this
         import has already taken, keyed by the trimmed lowercased
         text — a duplicate (even one that differs only by case or
         surrounding spaces) lands trigger-less instead of tripping
         the per-user unique index and rolling the whole import
         back. The stored trigger keeps the exact text from the
         file. */
      const liveTriggers = await client.query(
        "SELECT trigger FROM shortcuts WHERE user_id = $1 AND trigger <> '' AND deleted_at IS NULL",
        [userId],
      );
      const takenTriggers = new Set(
        liveTriggers.rows.map((r) => String(r.trigger).trim().toLowerCase()),
      );
      let imported = 0;
      let skipped = 0;
      for (const it of items) {
        const key = keyOf(it.title, it.body);
        if (seen.has(key)) {
          skipped++;
          continue;
        }
        seen.add(key);
        let trigger = it.trigger;
        if (trigger && takenTriggers.has(trigger.toLowerCase())) trigger = "";
        if (trigger) takenTriggers.add(trigger.toLowerCase());
        await client.query(
          "INSERT INTO shortcuts (user_id, title, body, category, tags, trigger, ext_shortcut, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [userId, it.title, it.body, it.category, it.tags, trigger, it.extShortcut, it.source],
        );
        imported++;
      }
      await client.query("COMMIT");
      console.log(`Imported ${imported}, skipped ${skipped} duplicates.`);
      console.log("Folders rebuild from categories automatically on first load (ensureFolders).");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  } else {
    // ---- full export mode ----
    const data = JSON.parse(readFileSync(fullFile as string, "utf-8")) as Record<string, unknown>;
    const users = (data.users as Record<string, unknown>[] | undefined) ?? [];
    const folders = (data.folders as Record<string, unknown>[] | undefined) ?? [];
    const shortcuts = (data.shortcuts as Record<string, unknown>[] | undefined) ?? [];
    const copyHistory = (data.copyHistory as Record<string, unknown>[] | undefined) ?? [];
    const sessions = (data.sessions as Record<string, unknown>[] | undefined) ?? [];
    const smartFolders = (data.smartFolders as Record<string, unknown>[] | undefined) ?? [];
    const siteConfig = (data.siteConfig as Record<string, unknown>[] | undefined) ?? [];
    const media = (data.media as Record<string, unknown>[] | undefined) ?? [];
    const avatars = (data.avatars as Record<string, unknown>[] | undefined) ?? [];
    console.log(
      `Full export: ${users.length} users, ${folders.length} folders, ${shortcuts.length} shortcuts, ` +
        `${copyHistory.length} copy-history rows, ${sessions.length} sessions, ` +
        `${smartFolders.length} smart folders, ${media.length} media rows, ${avatars.length} avatars${dryRun ? " (dry-run)" : ""}.`,
    );
    if (dryRun) process.exit(0);

    await client.query("BEGIN");
    try {
      const ins = async (sql: string, params: unknown[]) => {
        const r = await client.query(sql, params);
        return r.rowCount ?? 0;
      };
      let nUsers = 0;
      for (const u of users) {
        nUsers += await ins(
          `INSERT INTO users (id, name, phone, google_email, email, password_hash, avatar_blob_key, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [u.id, u.name, u.phone ?? null, u.googleEmail ?? null, u.email ?? null, u.passwordHash, u.avatarBlobKey ?? null, u.createdAt ?? new Date(), u.updatedAt ?? new Date()],
        );
      }
      let nFolders = 0;
      for (const f of folders) {
        nFolders += await ins(
          `INSERT INTO folders (id, user_id, name, icon, icon_color, source, is_source_main, parent_id, pinned, deleted_at, description, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
          [f.id, f.userId, f.name, f.icon ?? null, f.iconColor ?? null, f.source ?? "", f.isSourceMain ?? false, f.parentId ?? null, f.pinned ?? false, f.deletedAt ?? null, f.description ?? null, f.sortOrder ?? 0, f.createdAt ?? new Date(), f.updatedAt ?? new Date()],
        );
      }
      /* Triggers already live in the database, per user, keyed by
         the trimmed lowercased text — a restored trigger that
         duplicates another of the same user's (even one that
         differs only by case) would trip the per-user unique index
         and roll the whole restore back, so it lands trigger-less
         instead. Triggers are kept exactly as written in the file. */
      const liveTriggerRows = await client.query(
        "SELECT user_id, trigger FROM shortcuts WHERE trigger <> '' AND deleted_at IS NULL",
      );
      const takenByUser = new Map<number, Set<string>>();
      for (const r of liveTriggerRows.rows) {
        const uid = r.user_id as number;
        if (!takenByUser.has(uid)) takenByUser.set(uid, new Set());
        takenByUser.get(uid)!.add(String(r.trigger).trim().toLowerCase());
      }
      let nShortcuts = 0;
      for (const s of shortcuts) {
        let trigger = typeof s.trigger === "string" ? s.trigger.trim() : "";
        const uid = (s.userId as number | null) ?? null;
        if (trigger && uid !== null) {
          const taken = takenByUser.get(uid);
          if (taken?.has(trigger.toLowerCase())) trigger = "";
          else {
            if (!taken) takenByUser.set(uid, new Set());
            takenByUser.get(uid)!.add(trigger.toLowerCase());
          }
        }
        nShortcuts += await ins(
          `INSERT INTO shortcuts (id, user_id, title, body, category, tags, trigger, ext_shortcut, source, folder_id, sort_order, pinned, favorite, deleted_at, usage_count, last_used_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO NOTHING`,
          [s.id, s.userId ?? null, s.title, s.body, s.category ?? "عام", s.tags ?? "", trigger, s.extShortcut ?? "", s.source ?? "", s.folderId ?? null, s.sortOrder ?? 0, s.pinned ?? false, s.favorite ?? false, s.deletedAt ?? null, s.usageCount ?? 0, s.lastUsedAt ?? null, s.createdAt ?? new Date(), s.updatedAt ?? new Date()],
        );
      }
      let nHistory = 0;
      for (const h of copyHistory) {
        nHistory += await ins(
          `INSERT INTO copy_history (id, user_id, shortcut_id, title, copied_at)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [h.id, h.userId, h.shortcutId ?? null, h.title, h.copiedAt ?? new Date()],
        );
      }
      let nSessions = 0;
      for (const s of sessions) {
        nSessions += await ins(
          `INSERT INTO sessions (token, user_id, created_at, expires_at)
           VALUES ($1,$2,$3,$4) ON CONFLICT (token) DO NOTHING`,
          [s.token, s.userId, s.createdAt ?? new Date(), s.expiresAt],
        );
      }
      let nSmart = 0;
      for (const f of smartFolders) {
        nSmart += await ins(
          `INSERT INTO smart_folders (id, user_id, name, icon, icon_color, tags, folder_id, pinned_only, favorite_only, min_uses, unused_days, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
          [f.id, f.userId, f.name, f.icon ?? null, f.iconColor ?? null, f.tags ?? "", f.folderId ?? null, f.pinnedOnly ?? false, f.favoriteOnly ?? false, f.minUses ?? null, f.unusedDays ?? null, f.sortOrder ?? 0, f.createdAt ?? new Date(), f.updatedAt ?? new Date()],
        );
      }
      let nConfig = 0;
      for (const c of siteConfig) {
        nConfig += await ins(
          `INSERT INTO site_config (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
          [c.key, c.value],
        );
      }
      /* Reply media (URLs only — the bytes stay in Vercel Blob).
         Rows whose shortcut was not restored (or was skipped) are
         left out: the FK would reject them, so only rows whose
         shortcut exists in this database are inserted. */
      let nMedia = 0;
      for (const m of media) {
        if (m.kind !== "image") continue; /* images only — video rows from old backups are skipped */
        if (typeof m.blobUrl !== "string" || typeof m.blobPathname !== "string") continue;
        const shortcutExists = await client.query(
          "SELECT 1 FROM shortcuts WHERE id = $1",
          [m.shortcutId],
        );
        if (shortcutExists.rows.length === 0) continue;
        nMedia += await ins(
          `INSERT INTO reply_media (id, shortcut_id, user_id, kind, blob_url, blob_pathname, content_type, byte_size, width, height, duration_ms, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
          [m.id, m.shortcutId, m.userId, m.kind, m.blobUrl, m.blobPathname, m.contentType ?? "", m.byteSize ?? 0, m.width ?? null, m.height ?? null, m.durationMs ?? null, m.createdAt ?? new Date(), m.updatedAt ?? new Date()],
        );
      }
      let nAvatars = 0;
      for (const a of avatars) {
        const key = `avatars/${a.userId}`;
        nAvatars += await ins(
          `INSERT INTO avatar_blobs (key, data, content_type, updated_at)
           VALUES ($1, decode($2, 'base64'), $3, now()) ON CONFLICT (key) DO NOTHING`,
          [key, a.dataBase64, a.mimeType],
        );
        await client.query("UPDATE users SET avatar_blob_key = $1 WHERE id = $2", [key, a.userId]);
      }
      // Reset the id sequences past the imported rows.
      for (const [table] of [["users"], ["folders"], ["shortcuts"], ["copy_history"], ["smart_folders"], ["reply_media"]]) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
          [table],
        );
      }
      await client.query("COMMIT");
      console.log(
        `Inserted: ${nUsers} users, ${nFolders} folders, ${nShortcuts} shortcuts, ` +
          `${nHistory} copy-history rows, ${nSessions} sessions, ${nSmart} smart folders, ` +
          `${nConfig} config rows, ${nMedia} media rows, ${nAvatars} avatars.`,
      );
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await client.end();
}
