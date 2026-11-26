import { defineAction, z, type ActionsModule, type Ctx } from "./ctx.ts";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import * as schema from "./schema.ts";
import { del as blobDel } from "@vercel/blob";

/* ================= shapes ================= */

/* One image or video attached to a reply (see replyMedia in
   lib/schema.ts). The bytes live in Vercel Blob; this is only the
   reference + display metadata. null = the reply has no media. */
const mediaShape = z.object({
  kind: z.enum(["image", "video"]),
  blobUrl: z.string(),
  blobPathname: z.string(),
  contentType: z.string(),
  byteSize: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationMs: z.number().nullable(),
});

const shortcutShape = z.object({
  id: z.number(),
  title: z.string(),
  body: z.string(),
  category: z.string(),
  tags: z.string(),
  /* The reply's own expansion trigger ("" = none). */
  trigger: z.string(),
  extShortcut: z.string(),
  source: z.string(),
  folderId: z.number().nullable(),
  /* Attached image/video, or null. Joined in listShortcuts /
     listTrash; single-row actions return null (a fresh reply has
     no media, and attach/remove go through their own actions). */
  media: mediaShape.nullable(),
  sortOrder: z.number(),
  pinned: z.boolean(),
  favorite: z.boolean(),
  deletedAt: z.string().nullable(),
  usageCount: z.number(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/* The reply's origin as picked in the editor: a fixed list whose
   entries are the services' own English names, kept verbatim.
   The empty string means no source was recorded. Validated as an
   enum so the column can never hold a free-typed value. */
const sourceField = z.enum([
  "",
  "Chatwoot",
  "Text Blaze",
  "Google Sheets",
  "Google Docs",
]);

const folderShape = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().nullable(),
  iconColor: z.string().nullable(),
  source: z.string(),
  isSourceMain: z.boolean(),
  parentId: z.number().nullable(),
  pinned: z.boolean(),
  description: z.string().nullable(),
  deletedAt: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/* A smart folder is pure rules — it never owns replies. The client
   evaluates the rules against the live library. */
const smartFolderShape = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().nullable(),
  iconColor: z.string().nullable(),
  tags: z.string(),
  folderId: z.number().nullable(),
  pinnedOnly: z.boolean(),
  favoriteOnly: z.boolean(),
  minUses: z.number().nullable(),
  unusedDays: z.number().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type SmartFolderRow = typeof schema.smartFolders.$inferSelect;

function toSmartShape(row: SmartFolderRow): z.infer<typeof smartFolderShape> {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
    iconColor: row.iconColor ?? null,
    tags: row.tags ?? "",
    folderId: row.folderId ?? null,
    pinnedOnly: row.pinnedOnly,
    favoriteOnly: row.favoriteOnly,
    minUses: row.minUses ?? null,
    unusedDays: row.unusedDays ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type FolderRow = typeof schema.folders.$inferSelect;

function toFolderShape(row: FolderRow): z.infer<typeof folderShape> {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
    iconColor: row.iconColor ?? null,
    source: row.source ?? "",
    isSourceMain: row.isSourceMain ?? false,
    parentId: row.parentId ?? null,
    pinned: row.pinned,
    description: row.description ?? null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* The folder-icon catalogue: the only keys the icon column may hold.
   Mirrors FOLDER_ICON_OPTIONS in the client (same keys, same order) —
   anything else sent by a client is stored as null (automatic icon),
   never as junk the UI cannot render. */
const FOLDER_ICON_KEYS = [
  "folder",
  "star",
  "heart",
  "messages",
  "sparkles",
  "percent",
  "graduation",
  "wallet",
  "smartphone",
  "lifebuoy",
  "users",
  "calendar",
  "landmark",
  "info",
  "book",
  "clipboard",
  "archive",
  "zap",
  "shield",
  "clock",
  "phone",
  "mail",
  "globe",
  "flame",
  "layers",
  "file",
  "handshake",
  "home",
  "message-circle",
  "message-heart",
  "send",
  "inbox",
  "bell",
  "bell-ring",
  "megaphone",
  "headset",
  "headphones",
  "mic",
  "video",
  "share",
  "quote",
  "thumbs-up",
  "question",
  "banknote",
  "coins",
  "piggy",
  "credit-card",
  "receipt",
  "hand-coins",
  "dollar",
  "qr",
  "calculator",
  "chart",
  "backpack",
  "school",
  "library",
  "notebook",
  "pencil",
  "ruler",
  "atom",
  "flask",
  "sigma",
  "languages",
  "book-a",
  "test-tube",
  "presentation",
  "award",
  "trophy",
  "medal",
  "target",
  "lightbulb",
  "bookmark",
  "briefcase",
  "settings",
  "wrench",
  "flag",
  "pin",
  "paperclip",
  "printer",
  "folder-open",
  "folder-heart",
  "file-check",
  "scroll",
  "stamp",
  "key",
  "lock",
  "laptop",
  "monitor",
  "tablet",
  "tv",
  "camera",
  "wifi",
  "computer",
  "coffee",
  "gift",
  "crown",
  "gem",
  "rocket",
  "plane",
  "car",
  "map-pin",
  "compass",
  "sun",
  "moon",
  "leaf",
  "flower",
  "cat",
  "gamepad",
  "dumbbell",
  "stethoscope",
  "baby",
  "store",
  "shopping",
  "umbrella",
  "hourglass",
  "timer",
  "alarm",
  "calendar-check",
  "repeat",
  "heart-pulse",
  "hand-heart",
  "party",
  "sparkle",
  "palette",
  "shapes",
  "scale",
  "earth",
] as const;

function cleanFolderIcon(v: string | null | undefined): string | null {
  if (!v) return null;
  return (FOLDER_ICON_KEYS as readonly string[]).includes(v) ? v : null;
}

/* The folder icon-colour palette: the named keys the icon_color
   column may hold, plus ANY custom hex colour (#rrggbb) the owner
   picks from the colour picker — stored verbatim (lowercased) so
   a folder can wear literally any colour. Named keys mirror
   FOLDER_COLOR_OPTIONS in the client (same keys, same order) —
   anything that is neither a known key nor a valid hex is stored
   as null (automatic: the tile colour follows the folder's name). */
const FOLDER_COLOR_KEYS = [
  "royal",
  "sky",
  "cyan",
  "navy",
  "teal",
  "emerald",
  "green",
  "lime",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "rose",
  "pink",
  "red",
  "orange",
  "amber",
  "gold",
  "brown",
  "slate",
] as const;

const CUSTOM_COLOR_RE = /^#[0-9a-f]{6}$/i;

function cleanFolderIconColor(v: string | null | undefined): string | null {
  if (!v) return null;
  if ((FOLDER_COLOR_KEYS as readonly string[]).includes(v)) return v;
  if (CUSTOM_COLOR_RE.test(v)) return v.toLowerCase();
  return null;
}

const userShape = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  googleEmail: z.string().nullable(),
  /* Ready-to-render URL of the account's profile picture (a blob
     URL), or null when no picture is set — the client then shows
     the name's first letter, exactly as before. */
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});

type ShortcutRow = typeof schema.shortcuts.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type MediaRow = typeof schema.replyMedia.$inferSelect;

function toMediaShape(row: MediaRow): z.infer<typeof mediaShape> {
  return {
    kind: row.kind === "video" ? "video" : "image",
    blobUrl: row.blobUrl,
    blobPathname: row.blobPathname,
    contentType: row.contentType,
    byteSize: row.byteSize,
    width: row.width ?? null,
    height: row.height ?? null,
    durationMs: row.durationMs ?? null,
  };
}

function toShape(row: ShortcutRow, media?: MediaRow | null): z.infer<typeof shortcutShape> {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    tags: row.tags ?? "",
    trigger: row.trigger ?? "",
    extShortcut: row.extShortcut ?? "",
    source: row.source ?? "",
    folderId: row.folderId ?? null,
    media: media ? toMediaShape(media) : null,
    sortOrder: row.sortOrder,
    pinned: row.pinned,
    favorite: row.favorite ?? false,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function toUserShape(
  ctx: Ctx,
  row: UserRow,
): Promise<z.infer<typeof userShape>> {
  let avatarUrl: string | null = null;
  if (row.avatarBlobKey) {
    try {
      avatarUrl = await ctx.blobs.getUrl(row.avatarBlobKey);
    } catch {
      /* A missing/failed blob must never break sign-in or profile
         reads — the account simply falls back to its initial. */
      avatarUrl = null;
    }
  }
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    email: row.email ?? null,
    googleEmail: row.googleEmail ?? null,
    avatarUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

const okResponse = z.object({ ok: z.literal(true) });

const resetUsageResponse = z.object({
  ok: z.literal(true),
  clearedHistory: z.number(),
  resetReplies: z.number(),
});

const authResult = z.object({
  ok: z.boolean(),
  token: z.string().nullable(),
  user: userShape.nullable(),
  error: z.string().nullable(),
});

/* ================= auth helpers ================= */

/* Arabic keyboards do not agree on digit shapes: the same number can
   be typed with Western digits (0123), Arabic-Indic digits (٠١٢٣,
   U+0660–U+0669) or Eastern Arabic digits (۰۱۲۳, U+06F0–U+06F9)
   depending on the device and keyboard layout. A credential check
   that compares raw strings therefore rejects the very phone number
   or password the user registered with, simply because it was typed
   on a different keyboard. Folding every digit shape to ASCII 0-9
   before comparing makes the check about the digits themselves.
   Used for identifiers (phone/email) at every entry point; for
   passwords it is a fallback only (see verifyPassword), so a
   password that genuinely contains Arabic-Indic digits keeps
   working exactly as typed. */
function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹０-９]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x660 && code <= 0x669) return String(code - 0x660);
    if (code >= 0x6f0 && code <= 0x6f9) return String(code - 0x6f0);
    return String(code - 0xff10);
  });
}

function normalizePhone(raw: string): string {
  let p = normalizeDigits(raw).replace(/[\s\-()]/g, "");
  if (p.startsWith("+20")) p = "0" + p.slice(3);
  else if (p.startsWith("0020")) p = "0" + p.slice(4);
  else if (p.startsWith("20") && p.length === 12) p = "0" + p.slice(2);
  return p;
}

function isValidPhone(p: string): boolean {
  return /^01[0-9]{9}$/.test(p);
}

function normalizeEmail(raw: string): string {
  return normalizeDigits(raw.trim().toLowerCase());
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomToken(16);
  const hash = await sha256Hex(`${salt}:${password}`);
  return `${salt}$${hash}`;
}

/* The same password re-typed with each digit shape an Arabic
   keyboard can produce: as typed, folded to Western digits, and
   with its Western digits re-shaped to Arabic-Indic / Eastern
   Arabic. A password registered on one keyboard layout is routinely
   re-typed on another; every variant is the same digits in the
   same order, only drawn differently. */
function digitShapeVariants(password: string): string[] {
  const variants = new Set<string>([password]);
  variants.add(normalizeDigits(password));
  variants.add(
    normalizeDigits(password).replace(/[0-9]/g, (d) =>
      String.fromCharCode(0x660 + Number(d)),
    ),
  );
  variants.add(
    normalizeDigits(password).replace(/[0-9]/g, (d) =>
      String.fromCharCode(0x6f0 + Number(d)),
    ),
  );
  variants.add(
    normalizeDigits(password).replace(/[0-9]/g, (d) =>
      String.fromCharCode(0xff10 + Number(d)),
    ),
  );
  return [...variants];
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  /* The exact password as typed runs first; only if it misses do
     the other digit shapes of the same password get a try, so a
     password that genuinely contains Arabic-Indic digits keeps
     matching exactly as registered, and no different password can
     ever pass — the variants differ only in how the digits are
     drawn, never in which digits they are. */
  for (const variant of digitShapeVariants(password)) {
    if ((await sha256Hex(`${salt}:${variant}`)) === hash) return true;
  }
  return false;
}

// Sessions are effectively permanent: a one-year token that silently renews
// itself (sliding expiry) whenever it is used with less than half its life
// left. The user stays signed in on their device until they sign out
// themselves — signing out deletes the session row immediately.
const SESSION_MS = 365 * 24 * 60 * 60 * 1000;

async function createSession(
  ctx: Ctx,
  userId: number,
): Promise<string> {
  const db = ctx.db<typeof schema>();
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.insert(schema.sessions).values({ token, userId, expiresAt });
  return token;
}

/* Exported for the media upload route (app/api/media/upload):
   it resolves the same session token the actions use, so the
   token-minting step enforces the same auth as every action. */
export async function getSessionUser(ctx: Ctx, token: string): Promise<UserRow | null> {
  if (!token) return null;
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token))
    .limit(1);
  const session = rows[0];
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.token, token));
    return null;
  }
  // Background renewal: extend quietly so an active user is never signed out.
  if (session.expiresAt.getTime() - Date.now() < SESSION_MS / 2) {
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_MS) })
      .where(eq(schema.sessions.token, token));
  }
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  return users[0] ?? null;
}

async function requireUser(ctx: Ctx, token: string): Promise<UserRow> {
  const user = await getSessionUser(ctx, token);
  if (!user) throw new Error("انتهت الجلسة — سجّل دخولك من جديد");
  return user;
}

/** Throws unless the shortcut exists and belongs to this user.
    (Exported for the media upload route, same reason as
    getSessionUser above.) */
export async function requireOwnedShortcut(
  ctx: Ctx,
  userId: number,
  id: number,
): Promise<ShortcutRow> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.shortcuts)
    .where(
      and(
        eq(schema.shortcuts.id, id),
        eq(schema.shortcuts.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("الاختصار ده مش موجود في مكتبتك");
  return row;
}

/* ---- per-user expansion triggers ----
   A trigger is the text its owner types in the site's search /
   shortcut bar to expand this one reply. Rules, enforced here on the
   server — the client mirrors them only for instant feedback:
   - "" = no trigger.
   - otherwise: ANY text the owner types is valid — Arabic or Latin,
     any case, spaces, symbols, with or without a ";" prefix, any
     length up to the request cap (100 chars). The trigger is stored
     and shown EXACTLY as typed (only leading/trailing whitespace is
     trimmed); nothing is lowercased or reformatted.
   - unique among the same user's NON-deleted replies, compared
     case-insensitively on the trimmed text ("ترحيب" and " ترحيب "
     collide; so do "Salam" and "salam"). Another account may use
     the same text; a trashed reply frees its text. The DB's
     per-user unique index is case-sensitive, so it is only a second
     line of defence — the check below is what enforces the rule. */
function normalizeTrigger(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

async function assertTriggerAvailable(
  ctx: Ctx,
  userId: number,
  trigger: string,
  excludeId?: number,
): Promise<void> {
  if (trigger === "") return;
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ id: schema.shortcuts.id })
    .from(schema.shortcuts)
    .where(
      and(
        eq(schema.shortcuts.userId, userId),
        /* Case-insensitive on the trimmed text: lower() folds Latin
           case (Arabic has no case, so it passes through unchanged)
           and the stored values are already trimmed. */
        sql`lower(${schema.shortcuts.trigger}) = ${trigger.toLowerCase()}`,
        isNull(schema.shortcuts.deletedAt),
      ),
    )
    .limit(1);
  const clash = rows[0];
  if (clash && clash.id !== excludeId) {
    throw new Error("الاختصار ده مستخدم في رد تاني عندك — اختار اختصار مختلف");
  }
}

/* ================= reply media (Vercel Blob) =================
   One image or video per reply. The bytes live in Vercel Blob
   (public URLs); the DB holds only the reference. Limits are
   enforced BOTH client-side (for instant feedback) and here
   (the truth — a client can always be bypassed):
   - image: JPEG/PNG/WebP only, max 8 MB. GIF is excluded v1: it
     would be flattened to PNG on the clipboard anyway.
   - video: MP4/WebM only, max 50 MB, max 5 minutes. MOV is
     excluded v1 (its container is not a web-native clipboard or
     <video> type).
   Pathnames are always `media/<userId>/<shortcutId>/<uuid>.<ext>` —
   never the user's original filename — and the URL must be a
   Vercel Blob public host, so attachMedia can never be used to
   point a reply at an arbitrary third-party URL. */
export const MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MEDIA_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_DURATION_MS = 5 * 60 * 1000;
/* The pathname shape the client builds (uuid from
   crypto.randomUUID, extension from the file). The upload route
   re-checks the userId/shortcutId prefix against the session. */
export const MEDIA_PATH_RE = /^media\/(\d+)\/(\d+)\/[0-9a-f-]+\.(jpe?g|png|webp|mp4|webm)$/i;

export function mediaLimitsFor(kind: "image" | "video"): {
  contentTypes: readonly string[];
  maxBytes: number;
} {
  return kind === "image"
    ? { contentTypes: MEDIA_IMAGE_TYPES, maxBytes: MEDIA_IMAGE_MAX_BYTES }
    : { contentTypes: MEDIA_VIDEO_TYPES, maxBytes: MEDIA_VIDEO_MAX_BYTES };
}

/** Deletes one Blob object. A failure is logged but never fails
    the caller's removal — an orphaned object is harmless (same
    tolerance as removeAvatar), and the DB row is the source of
    truth for what the site shows. Without a Blob store connected
    (no BLOB_READ_WRITE_TOKEN) this throws BlobAccessError at once,
    which is caught here too. */
async function deleteBlobObject(pathname: string): Promise<void> {
  try {
    await blobDel(pathname);
  } catch (e) {
    console.error(
      `reply media: blob del failed for ${pathname}:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/** The Blob pathnames referenced by the given replies (queried
    BEFORE the rows are deleted — afterwards the pathnames are
    gone). Callers delete the rows, then pass these pathnames to
    deleteBlobsIfUnreferenced below. */
async function mediaPathnamesForShortcuts(
  ctx: Ctx,
  shortcutIds: number[],
): Promise<string[]> {
  if (shortcutIds.length === 0) return [];
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ blobPathname: schema.replyMedia.blobPathname })
    .from(schema.replyMedia)
    .where(inArray(schema.replyMedia.shortcutId, shortcutIds));
  return [...new Set(rows.map((r) => r.blobPathname))];
}

/** Deletes each Blob object whose pathname is no longer referenced
    by ANY reply_media row. A duplicated reply shares the same
    Blob object (same pathname, new row), so the object must survive
    while any copy still points at it — this check runs AFTER the
    caller's row deletes, so the remaining rows are the truth. */
async function deleteBlobsIfUnreferenced(
  ctx: Ctx,
  pathnames: string[],
): Promise<void> {
  if (pathnames.length === 0) return;
  const db = ctx.db<typeof schema>();
  for (const p of pathnames) {
    const refs = await db
      .select({ id: schema.replyMedia.id })
      .from(schema.replyMedia)
      .where(eq(schema.replyMedia.blobPathname, p))
      .limit(1);
    if (refs.length === 0) await deleteBlobObject(p);
  }
}

/** Appends one entry to the account's copy history and prunes it to
    the latest 200 entries, so the history stays a real, bounded log
    of successful copies — never of failed ones (callers invoke this
    only after a copy/expansion actually happened). */
async function logCopy(
  ctx: Ctx,
  userId: number,
  shortcut: { id: number; title: string },
): Promise<void> {
  const db = ctx.db<typeof schema>();
  await db.insert(schema.copyHistory).values({
    userId,
    shortcutId: shortcut.id,
    title: shortcut.title,
  });
  // Postgres: same prune, parameterized (the SQLite original interpolated
  // the numeric userId into the string; pg must not).
  await db.execute(
    sql`DELETE FROM copy_history WHERE user_id = ${userId} AND id NOT IN (SELECT id FROM copy_history WHERE user_id = ${userId} ORDER BY copied_at DESC, id DESC LIMIT 200)`,
  );
}


/* ================= folders (hierarchical tree) ================= */

/** The ids of the user's trashed folders. A reply inside a trashed
    folder is hidden with it (the folder's soft delete covers its
    whole subtree), so every library listing filters these out. */
async function trashedFolderIds(ctx: Ctx, userId: number): Promise<Set<number>> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ id: schema.folders.id })
    .from(schema.folders)
    .where(
      and(eq(schema.folders.userId, userId), isNotNull(schema.folders.deletedAt)),
    );
  return new Set(rows.map((r) => r.id));
}

/** A shortcut is visible in the library when it is not itself
    trashed and its folder (if any) is not trashed. */
function isVisibleShortcut(
  row: ShortcutRow,
  trashedFolders: Set<number>,
): boolean {
  if (row.deletedAt) return false;
  if (row.folderId !== null && row.folderId !== undefined && trashedFolders.has(row.folderId))
    return false;
  return true;
}

/** Permanently deletes a folder, its whole subtree and every reply
    inside them (trashed or not). Used only by the trash's permanent
    deletion paths, after the caller verified the root is trashed.
    Returns how many rows (folders + replies) were removed. */
async function hardDeleteFolderTree(
  ctx: Ctx,
  userId: number,
  rootId: number,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const all = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId));
  const childrenOf = new Map<number, number[]>();
  for (const f of all) {
    if (f.parentId === null || f.parentId === undefined) continue;
    const arr = childrenOf.get(f.parentId) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parentId, arr);
  }
  const ids: number[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    ids.push(cur);
    for (const c of childrenOf.get(cur) ?? []) queue.push(c);
  }
  /* Media pathnames first: the reply rows (and their media rows,
     by cascade) vanish below, and the pathnames with them. The
     Blob objects are dropped after the deletes, only when no
     surviving reply still references them (a duplicate shares
     the object). */
  const doomed = await db
    .select({ id: schema.shortcuts.id })
    .from(schema.shortcuts)
    .where(
      and(
        eq(schema.shortcuts.userId, userId),
        inArray(schema.shortcuts.folderId, ids),
      ),
    );
  const mediaPathnames = await mediaPathnamesForShortcuts(
    ctx,
    doomed.map((d) => d.id),
  );
  let removed = 0;
  for (const fid of ids) {
    const gone = await db
      .delete(schema.shortcuts)
      .where(
        and(
          eq(schema.shortcuts.userId, userId),
          eq(schema.shortcuts.folderId, fid),
        ),
      )
      .returning({ id: schema.shortcuts.id });
    removed += gone.length;
  }
  for (const fid of ids) {
    await db
      .delete(schema.folders)
      .where(and(eq(schema.folders.id, fid), eq(schema.folders.userId, userId)));
    removed += 1;
  }
  await deleteBlobsIfUnreferenced(ctx, mediaPathnames);
  return removed;
}

/** Throws unless the folder exists and belongs to this user. */
async function requireOwnedFolder(
  ctx: Ctx,
  userId: number,
  id: number,
): Promise<FolderRow> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select()
    .from(schema.folders)
    .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("المجلد ده مش موجود في مكتبتك");
  return row;
}

/** The canonical top-level folder order for libraries that predate the
    folders table — mirrors the client's known category order. */
const FOLDER_SEED_ORDER = [
  "ترحيب",
  "مميزات وأسئلة",
  "أسعار",
  "بكالوريا",
  "دفع",
  "فودافون كاش",
  "دعم فني",
  "مدرسين",
  "مواعيد",
  "قواعد",
  "معلومات عامة",
  "عام",
];

/** Ensures the account has folder rows for every category its shortcuts
    already use, and that every shortcut points at its folder. Runs
    lazily on first tree load; insert-only, never renames or deletes. */
async function ensureFolders(ctx: Ctx, userId: number): Promise<FolderRow[]> {
  const db = ctx.db<typeof schema>();
  let folders = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId))
    .orderBy(asc(schema.folders.sortOrder), asc(schema.folders.id));
  const mine = await db
    .select()
    .from(schema.shortcuts)
    .where(eq(schema.shortcuts.userId, userId));
  const byName = new Map(folders.map((f) => [f.name, f]));
  const needed = new Set(mine.map((s) => s.category));
  let order = folders.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
  const orderedNames = [
    ...FOLDER_SEED_ORDER.filter((n) => needed.has(n)),
    ...[...needed].filter((n) => !FOLDER_SEED_ORDER.includes(n)),
  ];
  for (const name of orderedNames) {
    if (byName.has(name)) continue;
    const inserted = await db
      .insert(schema.folders)
      .values({ userId, name, parentId: null, sortOrder: order++ })
      .returning();
    const row = inserted[0];
    if (row) byName.set(name, row);
  }
  // Link shortcuts that have no folder yet to the folder of their category.
  for (const s of mine) {
    if (s.folderId !== null && s.folderId !== undefined) continue;
    const folder = byName.get(s.category);
    if (!folder) continue;
    const siblings = mine.filter((x) => x.category === s.category);
    await db
      .update(schema.shortcuts)
      .set({ folderId: folder.id, sortOrder: siblings.indexOf(s) })
      .where(eq(schema.shortcuts.id, s.id));
  }
  folders = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId))
    .orderBy(asc(schema.folders.sortOrder), asc(schema.folders.id));
  return folders;
}

/** True when `candidateId` is `folderId` itself or one of its descendants. */
async function isSelfOrDescendant(
  ctx: Ctx,
  userId: number,
  folderId: number,
  candidateId: number,
): Promise<boolean> {
  if (candidateId === folderId) return true;
  const db = ctx.db<typeof schema>();
  const all = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId));
  const parentOf = new Map(all.map((f) => [f.id, f.parentId ?? null]));
  let cur: number | null = candidateId;
  const guard = new Set<number>();
  while (cur !== null && !guard.has(cur)) {
    if (cur === folderId) return true;
    guard.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

/** Claims ownerless legacy shortcuts for the first account that has none. */
async function claimLegacyShortcuts(ctx: Ctx, userId: number): Promise<void> {
  const db = ctx.db<typeof schema>();
  const mine = await db
    .select({ id: schema.shortcuts.id })
    .from(schema.shortcuts)
    .where(eq(schema.shortcuts.userId, userId))
    .limit(1);
  if (mine.length > 0) return;
  await db
    .update(schema.shortcuts)
    .set({ userId })
    .where(isNull(schema.shortcuts.userId));
}

/* ================= seed (Ibrahim's playbook, verbatim) ================= */

const SEED: Array<{
  title: string;
  category: string;
  pinned?: boolean;
  body: string;
}> = [
  {
    title: "رد السلام",
    category: "ترحيب",
    pinned: true,
    body: "وعليكم السلام ورحمة الله وبركاته 🤩",
  },
  {
    title: "ترحيب — ولد",
    category: "ترحيب",
    pinned: true,
    body: "أهلاً بيك 🤍 معاك إبراهيم من موقع الخطة التعليمي 🥰🤍 بنتمنى لك يوم جميل ويا رب تكون بخير🤍 مبسوطين جداً من تواصلك معانا 🥰",
  },
  {
    title: "ترحيب — بنت",
    category: "ترحيب",
    pinned: true,
    body: "أهلاً بيكي 🤍 معاكي إبراهيم من موقع الخطة التعليمي 🥰🤍 بنتمنى لك يوم جميل ويا رب تكوني بخير🤍 مبسوطين جداً من تواصلك معانا 🥰",
  },
  {
    title: "المميزات — باقتين المنصة",
    category: "مميزات وأسئلة",
    pinned: true,
    body: `دلوقتي هوضح لك النظام الدراسي في المنصة 💖
بيكون متاح معانا باقتين:

📌 باقة الخطة ( المحتوى ): 

♦ شرح شامل لكل المواد بيكون عن طريق فيديوهات مسجلة تقدر تعيده في أي وقت بعدد لانهائي من المرات 

♦ فيديوهات لأهم أفكار الكتب الخارجية بعد كل درس 📚

♦ واجب وامتحان بعد كل درس 

♦ تلخيص بعد كل درس بصيغة PDF

♦ خدمة "اسأل المدرس" لو عندك أي سؤال او استفسار بخصوص المادة المشترك بها تقدر تسأل مدرس حقيقي يرد عليك في كل جميع استفساراتك في المادة

.
.

📌 أما باقة الخطة كلاس ( المحتوى و المتابعة ) فبتاخد فيها كل المميزات السابقة ✅
 وكمان:


♦ مشرفة متابعة بترتبلك مذاكرتك وتشجعك على طول

♦ جروب للمتابعة فيه تفاعل ومسابقات وجوائز 🏆

♦ جدول يومي ينظم وقتك بشكل مناسب

♦ تقارير دورية ليك ولولي الأمر علشان تتابع مستواك وتطمن وتبقي من الأوائل 💪`,
  },
  {
    title: "سؤال الخصم — السنة معروفة",
    category: "مميزات وأسئلة",
    body: `حالياً الاشتراك للترم الأول بالكامل بخصم كبير لفترة محدودة 🎁🥳
ممكن أعرف عربي ولا لغات عشان اقولك تفاصيل الأسعار ونلحق الخصم 🤩`,
  },
  {
    title: "سؤال الخصم — السنة مش معروفة",
    category: "مميزات وأسئلة",
    body: `حالياً الاشتراك للترم الأول بالكامل بخصم كبير لفترة محدودة 🎁🥳
ممكن أعرف السنة الدراسية و عربي ولا لغات عشان اقولك تفاصيل الأسعار ونلحق الخصم 🤩`,
  },
  {
    title: "سؤال الشعبة — تالتة ثانوي",
    category: "مميزات وأسئلة",
    body: "ممكن أعرف شعبة إيه؟ علمي علوم، علمي رياضة، ولا أدبي؟ عشان أبعتلك التفاصيل المناسبة 🤍",
  },
  {
    title: "تحب تعرف طريقة الدفع؟",
    category: "دفع",
    body: "تحب تعرف طريقة الدفع والاشتراك عشان تلحق الخصم 🤩",
  },
  {
    title: "خطوات الدفع — فوري",
    category: "دفع",
    pinned: true,
    body: `📌 طريقة الدفع عن طريق فوري:

1️⃣ الدخول على منصة الخطة من هنا:
🌐 https://elkheta.com/

2️⃣ من القائمة الموجودة على اليمين، يتم اختيار «الاشتراكات».

3️⃣ اختيار نوع الاشتراك المطلوب، سواء اشتراك مادة واحدة أو أي نوع اشتراك آخر.

4️⃣ هتظهر خانة أسفل الصفحة 👇
يتم كتابة رقم موبايل الطالب المسجل على الموقع فيها 📱

5️⃣ بعد إدخال البيانات، يتم الضغط على «إرسال كود الدفع».
هيظهر كود دفع بيبدأ برقم 97.

6️⃣ يمكن استخدام الكود للدفع من أي سوبر ماركت متاح فيه خدمة فوري، أو من خلال تطبيق فوري في حالة توفره. 💳

⏳ ملحوظة: كود الدفع بيكون صالح لمدة يومين فقط.

🎥 ممكن متابعة الفيديو التالي، وهيساعد في خطوات التسجيل والاشتراك بإذن الله:
https://youtube.com/shorts/kWT0XwYGCf8?si=w7mqOFF3VkI6QfxN

وبمجرد إتمام الدفع عن طريق فوري، الحساب بيتفعّل مباشرة 🤍✨`,
  },
  {
    title: "الاعتراض على طريقة الدفع",
    category: "دفع",
    body: "طريقة الدفع المتاحة حالياً هي من خلال فوري، وده الأفضل لأن اشتراك الطالب بيتفعل مباشرة بمجرد الدفع، على عكس الدفع عن طريق المحافظ أو إنستا باي اللي بيحتاج وقت أطول في التفعيل 🤍",
  },
  {
    title: "ابتدائي أقل من رابع — غير متاح",
    category: "قواعد",
    body: "حاليا بيكون متاح الاشتراك بداية من الصف الرابع الابتدائي للصف الثالث الثانوي فقط",
  },
];

const NOTE =
  "👈الاشتراك الشهري بيكون لمدة 30 يوم فقط، وبمجرد انتهاء مدة الاشتراك بيتم حجب الحصص مؤقتًا، وبتقدر ترجع تتابع المحتوى بشكل طبيعي بعد تجديد الاشتراك.🤍";

SEED.push(
  {
    title: "أسعار ابتدائي وإعدادي — عربي",
    category: "أسعار",
    body: `📌 باقة المحتوى فقط:
شهري: 600 ج لكل المواد / 130 ج للمادة
الترم: 900 ج بدل 1200 / 195 ج للمادة بدل 260
السنة: 2400 ج بدل 3000 / 520 ج للمادة بدل 650
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 700 ج لكل المواد / 200 ج للمادة
الترم: 1050 ج بدل 1400 / 300 ج للمادة بدل 400
السنة: 2800 ج بدل 3500
${NOTE}`,
  },
  {
    title: "أسعار ابتدائي وإعدادي — لغات",
    category: "أسعار",
    body: `📌 باقة المحتوى فقط:
شهري: 700 ج لكل المواد / 180 ج للمادة
الترم: 1050 ج بدل 1400 / 270 ج للمادة بدل 360
السنة: 2800 ج بدل 3500 / 720 ج للمادة بدل 900
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 800 ج لكل المواد / 280 ج للمادة
الترم: 1200 ج بدل 1600 / 420 ج للمادة بدل 560
السنة: 3200 ج بدل 4000
${NOTE}`,
  },
  {
    title: "أسعار أولى ثانوي — عربي",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 700 ج لكل المواد / 150 ج للمادة
الترم: 1050 ج بدل 1400 / 225 ج للمادة بدل 300
السنة: 2800 ج بدل 3500 / 600 ج للمادة بدل 750
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 800 ج لكل المواد / 250 ج للمادة
الترم: 1200 ج بدل 1600 / 375 ج للمادة بدل 500
السنة: 3200 ج بدل 4000
${NOTE}`,
  },
  {
    title: "أسعار أولى ثانوي — لغات",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 850 ج لكل المواد / 250 ج للمادة
الترم: 1275 ج بدل 1700 / 375 ج للمادة بدل 500
السنة: 3400 ج بدل 4250 / 1000 ج للمادة بدل 1250
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 950 ج لكل المواد / 350 ج للمادة
الترم: 1425 ج بدل 1900 / 525 ج للمادة بدل 700
السنة: 3800 ج بدل 4750
${NOTE}`,
  },
  {
    title: "أسعار تانية ثانوي عام — عربي",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 700 ج لكل المواد / 150 ج للمادة
الترم: 1050 ج بدل 1400 / 225 ج للمادة بدل 300
السنة: 2800 ج بدل 3500 / 600 ج للمادة بدل 750
📌 باقة الخطة كلاس (المحتوى والمتابعة):
❌ غير متاحة`,
  },
  {
    title: "أسعار تانية ثانوي عام — لغات",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 850 ج لكل المواد / 250 ج للمادة
الترم: 1275 ج بدل 1700 / 375 ج للمادة بدل 500
السنة: 3400 ج بدل 4250 / 1000 ج للمادة بدل 1250
📌 باقة الخطة كلاس (المحتوى والمتابعة):
❌ غير متاحة`,
  },
  {
    title: "أسعار تالتة ثانوي — عام عربي",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 700 ج لكل المواد / 150 ج للمادة
3 شهور (90 يوم): 1400 ج لكل المواد بدل 2100 / 375 ج للمادة بدل 450
السنة: 2800 ج لكل المواد بدل 3500 / 600 ج للمادة بدل 750
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 800 ج لكل المواد / 250 ج للمادة
3 شهور (90 يوم): 1800 ج لكل المواد بدل 2400 / 700 ج للمادة
السنة: 3200 ج لكل المواد بدل 4000
${NOTE}`,
  },
  {
    title: "أسعار تالتة ثانوي — عام لغات",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 850 ج لكل المواد / 250 ج للمادة
3 شهور (90 يوم): 1700 ج لكل المواد بدل 2550 / 625 ج للمادة بدل 750
السنة: 3400 ج لكل المواد بدل 4250 / 1000 ج للمادة بدل 1250
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 950 ج لكل المواد / 350 ج للمادة
3 شهور (90 يوم): 2138 ج لكل المواد بدل 2850 / 1000 ج للمادة
السنة: 3800 ج لكل المواد بدل 4750
${NOTE}`,
  },
  {
    title: "أسعار تالتة ثانوي — علمي رياضة لغات",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا مادة ال Math و اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 600 ج لكل المواد / 250 ج للمادة
3 شهور (90 يوم): 1,200 ج لكل المواد
السنة: 2,400 ج لكل المواد
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 700 ج لكل المواد / 350 ج للمادة
3 شهور (90 يوم): 1,400 ج لكل المواد
السنة: 2800 ج لكل المواد
${NOTE}`,
  },
  {
    title: "أسعار تالتة ثانوي — أدبي لغات",
    category: "أسعار",
    body: `✨المواد المتاحة: جميع المواد على المنصة (ما عدا مادة ال Math و اللغة الإيطالية).
📌 باقة المحتوى فقط:
شهري: 750 ج لكل المواد
3 شهور (Quarter): 1,500 ج لكل المواد
السنة: 2625 ج لكل المواد
📌 باقة الخطة كلاس (المحتوى والمتابعة):
شهري: 850 ج لكل المواد
3 شهور (Quarter): 1,900 ج لكل المواد
السنة: 2975 ج لكل المواد
${NOTE}`,
  },
  {
    title: "أسعار تانية ثانوي بكالوريا — كل المسارات",
    category: "بكالوريا",
    body: `مواد البكالوريا المتاحة حاليًا📚 لجميع المسارات💠 التاريخ ⇐ مستر محمد خليل📌 المحتوى فقط:

شهري ← 200 ج 3 شهور ← 550 ج📌 الخطة كلاس (المحتوى والمتابعة):

شهري ← 300 ج 3 شهور ← 850 ج***************************

🩺 مسار الطب وعلوم الحياة – عام💠 الرياضيات ⇐ مستر محمد الصمدي📌 المحتوى فقط:

شهري ← 250 ج 3 شهور ← 700 ج📌 الخطة كلاس (المحتوى والمتابعة):

شهري ← 350 ج 3 شهور ← 1,000 ج***************************

🩺 مسار الطب وعلوم الحياة – لغات

💠 Math ⇐ مستر شادي الشرقاوي📌 المحتوى فقط:

شهري ← 400 ج 3 شهور ← 1,100 ج

📌 الخطة كلاس (المحتوى والمتابعة):

شهري ← 500 ج 3 شهور ← 1,400 ج***************************🩺 مسار الطب وعلوم الحياة – لغات

💠 Physics ⇐ مستر عبدالله جبريل 📌 المحتوى فقط:

شهري ← 400 ج 3 شهور ← 1,100 ج📌 الخطة كلاس (المحتوى والمتابعة):

شهري ← 500 ج3 شهور ← 1,400 ج***************************

🎨 مسار الآداب والفنون

💠علم النفس ⇐ مستر محمد عبدالقادر📌 المحتوى فقط:

شهري ← 200 ج 3 شهور ← 550 ج📌 الخطة كلاس (المحتوى والمتابعة):

شهري ← 300 ج 3 شهور ← 850 ج━━━━━━━━━━━━━━━━

📢 جميع الأسعار للمادة الواحدة.

━━━━━━━━━━━━━━━━`,
  },
);

/* ---- Content pack 2 (2026-11-17): the user's full content dump,
   organized into folders. Every body is the user's own text,
   copied verbatim from ~/workspace/elkheta/content_dump_20261117.txt;
   blocks that duplicated an existing reply (or repeated inside the
   dump) were skipped so each reply exists exactly once. ---- */
SEED.push(
  {"title": "مشترك معانا ولا أبعتلك التفاصيل؟", "category": "مميزات وأسئلة", "body": "ممكن اعرف انت مشترك معانا على الموقع\nولا تحب ابعتلك تفاصيل ومميزات الاشتراك 🥰🤍"},
  {"title": "كل المحتوى متاح ليك + المراجعات النهائية", "category": "مميزات وأسئلة", "body": "كل المحتوى والحصص والشرح الموجودين على الموقع بيكونوا متاحين ليك،\nوكمان هتقدر تتابع المراجاعت النهائية اللي هتساعدك تلم المنهج في وقت بسيط 😍"},
  {"title": "كل المحتوى متاح + الحصص الجديدة والمراجعات", "category": "مميزات وأسئلة", "body": "كل المحتوى والحصص والشرح الموجودين على الموقع بيكونوا متاحين ليك،\nوكمان هتقدر تتابع الحصص الجديدة اللي بتنزل طول فترة اشتراكك\nو هتقدر تتابع المراجعات النهائية اللي هتساعدك تلم المنهج في وقت بسيط 😍"},
  {"title": "كل مدرسين صفك وشعبتك متاحين ليك", "category": "مميزات وأسئلة", "body": "كل المدرسين المتاحين علي الموقع للعام الدراسي والشعبة الخاصة بيك بيكون متاح ليك متابعة الشرح الخاص بيهم بشكل كامل على اشتراكك 😍🤍"},
  {"title": "اسأل مدرس — التواصل مع المدرسين", "category": "معلومات عامة", "body": "بيكون متاح ليك التواصل مع المدرسين من خلال خاصية اسأل مدرس في كل المواد ويتم الاجابة على استفسارك من قبل مجموعة من المدرسين المتخصصين 😍🤍"},
  {"title": "المراجعات النهائية — هتكون متاحة إمتى", "category": "معلومات عامة", "body": "المراجعات النهائية هتكون متاحة بإذن الله أول ما نتنهي من شرح المنهج بالكامل على الموقع، علشان توصلك بأفضل صورة."},
  {"title": "اليوتيوب عليه الحصص التمهيدية بس", "category": "مميزات وأسئلة", "body": "الحصص والشرح و باقي المميزات بشكل كامل بيكون متاح على الموقع للمشتركين،\nاليوتيوب بيكون متاح عليه الحصص التمهيدية فقط \nبالإضافة للمراجعات 🤍🙏"},
  {"title": "رقم التواصل هاتفياً", "category": "معلومات عامة", "body": "تقدر تتواصل معانا هاتفياً على الرقم التالي وهنرد على كل استفساراتك  😍\n01012075397"},
  {"title": "سياسة الاسترداد", "category": "قواعد", "body": "📌 سياسة الاسترداد 🤍\n\nحرصًا على إتاحة فرصة كافية للطالب للاستفادة من الاشتراك، بيكون الاسترداد متاح في الحالات التالية:\n\nالباقة الشهرية: خلال 5 أيام من تاريخ الدفع.\nالباقة الترم أو السنوية: خلال 15 يومًا من تاريخ الدفع.\n\nوذلك في حالة وجود مشكلة في الموقع تؤثر على الاستفادة من الاشتراك، مع إمكانية التواصل معانا أولًا لمحاولة حل أي مشكلة قبل طلب الاسترداد. 🤍\n\nوفي غير الحالات دي، بيكون الاسترداد غير متاح وفقًا لسياسة الاسترداد المعتمدة أثناء الاشتراك.\n\n📄 تقدر تراجع سياسة الاسترداد كاملة من هنا:\nhttps://elkheta.com/refund-policy/", "pinned": true},
  {"title": "مشكلة فوري — اتخصم المبلغ وموصلش للمنصة", "category": "دعم فني", "body": "واضح عندي على السيستم إن العملية اتنفذت من عندك واتخصم المبلغ، لكن للأسف ما وصلش للمنصة، وعلشان كده الحساب لم يفعل.\nممكن نتواصل مع خدمة عملاء فوري، وهما هيساعدونا يا إما بإتمام العملية على المنصة، أو بإرجاع المبلغ لحسابك مرة تانية.\nاطمن الموضوع بسيط وهيتحل إن شاء الله 🤍"},
  {"title": "تقصد كود الدفع ولا كود كلمة المرور؟", "category": "مميزات وأسئلة", "body": "ممكن توضيح المقصود بالكود؟\nهل تقصد كود الدفع ولا كود تغيير كلمة المرور؟ عشان نقدر نساعدك بشكل أدق 🤍"},
  {"title": "الحصة في المونتاج — متاحة قريب جداً", "category": "معلومات عامة", "body": "حاليًا بيتم العمل على مونتاجها، وهتكون متاحة قريب جدًا بإذن الله.\nونعتذر لك جدًا عن التأخير. 🤍"},
  {"title": "مسح الملفات المؤقتة — خطوات التطبيق", "category": "دعم فني", "body": "لو التطبيق فيه مشكلة، جرّب تمسح الملفات المؤقتة بالطريقة دي 👇📱\n\n\n1️⃣ افتح الإعدادات\n 2️⃣ ادخل على التطبيقات\n 3️⃣ اختار التطبيق بتاعنا\n 4️⃣ ادخل على التخزين\n 5️⃣ اضغط على مسح الملفات المؤقتة\n\n\n✅ بعد كده افتح التطبيق تاني وجرب\n\n\n⚠️ مهم جدًا:\n اضغط على مسح الملفات المؤقتة فقط\n ومتضغطش على مسح البيانات عشان بياناتك متتمسحش 🤍"},
  {"title": "ميزة الجدول — متاحة للخطة كلاس", "category": "مميزات وأسئلة", "body": "ميزة الجدول بتكون متاحة للمشتركين في باقة الخطة كلاس"},
  {"title": "التفاصيل والأسعار مع بداية العام الجديد", "category": "معلومات عامة", "body": "ممكن تتواصل معانا مع بداية العام الدراسي الجديد و هنبلغك التفاصيل و الاسعار بالكامل بإذن الله 🤍"},
  {"title": "المذكرات والمراجعات المجانية — الرابط", "category": "معلومات عامة", "body": "المذكرات و الامتحانات الشاملة و المراجعات المجانية موجودة بالكامل بشكل مجاني على الموقع \nتقدر توصل لها من خلال الرابط التالي : \nhttps://elkheta.com/study-content"},
  {"title": "بتسأل عن الاشتراك للعام الجديد؟", "category": "مميزات وأسئلة", "body": "بتسأل عن الاشتراك للعام الدراسي الجديد، صحيح؟ 🤍"},
  {"title": "السنة الدراسية عشان أبعت المراجعات المجانية", "category": "مميزات وأسئلة", "body": "ممكن اعرف السنة الدراسية عشان ابعت لك المراجعات المجانية 🤍"},
  {"title": "اسأل مدرس — نبعت سؤالك للمدرسين", "category": "معلومات عامة", "body": "ممكن نتواصل مع خدمة اسأل مدرس ونبعتلهم السؤال، وبإذن الله هيتم الرد ومساعدتك بشكل كامل\nلأنهم على دراية أوسع بالمنهج وتفاصيله 🤍"},
  {"title": "تأكيد البيانات — فودافون كاش (ياسمين)", "category": "فودافون كاش", "body": "حابين نأكد مع حضرتك بيانات الاشتراك قبل إتمام الدفع 🤍\n📚 الباقة:\n💰 سعر الاشتراك:\n💳 طريقة الدفع:\nتقدر تحوّل على رقم فودافون كاش التالي (باسم ياسمين)👇\n01025238305\nوبعد التحويل، ياريت تبعتلنا صورة واضحة لعملية الدفع 📸، مع البيانات التالية:\nاسم الطالب\nرقم الطالب\nرقم وليّ الأمر\nالسنة الدراسية والتخصص\nاسم الباقة أو المواد المشترك فيها\nالرقم اللي تم التحويل منه\nوبمجرد استلام البيانات وصورة الدفع، هنراجعها ونفعّل الاشتراك في أسرع وقت بإذن الله 🤍", "pinned": true},
  {"title": "تأكيد الدفع — نتواصل مع الرقم اللي حوّلت منه", "category": "فودافون كاش", "body": "ممكن نتواصل مع الرقم اللي بعت لنا الرقم اللي ندفع عليه ونبعت له البيانات كاملة، علشان يتم تأكيد عملية الدفع ومراجعة البيانات، وبإذن الله هيتم تفعيل الحساب في أقرب وقت ممكن. 🤍"},
  {"title": "كتاب اسكتشات فاهم — الفورم", "category": "معلومات عامة", "body": "📚 لو حابب تعرف تفاصيل كتاب \"اسكتشات فاهم\" وتشوف أول درس مجانًا، تقدر تملأ الفورم من هنا، وهتلاقي فيه كل التفاصيل الخاصة بالكتاب:\nhttps://forms.gle/F8NSo5sgDsZq3wnX7 🤍"},
  {"title": "رقم التواصل واتساب", "category": "معلومات عامة", "body": "تقدر تتواصل معانا واتساب على الرقم التالي وهنرد على كل استفساراتك 😍\n01003167115"},
  {"title": "مفيش تأخير — كل مدرس عنده خطة منظمة", "category": "معلومات عامة", "body": "بإذن الله مش هيكون فيه أي تأخير، لأن كل مدرس بيكون حاطط خطة دراسية واضحة ومنظمة لإنهاء شرح المنهج بالكامل قبل بداية فترة المراجعات بوقت مناسب، وده بيدي الطالب فرصة كافية يراجع كل الدروس ويعوض أي جزء فاته.\nاطمن تمامًا 🤍"},
  {"title": "حساب ولي الأمر — بيتم إنشاؤه إزاي", "category": "معلومات عامة", "body": "حساب ولي الأمر بيتم إنشاؤه من خلال المشرفة بعد اشتراك الطالب في باقة الخطة كلاس (المحتوى والمتابعة)🤍"},
  {"title": "الدفع بفودافون كاش أو انستا باي — بديل فوري", "category": "فودافون كاش", "body": "بما إن الدفع عن طريق فوري فيه صعوبة بالنسبة لك، تقدر تدفع بكل سهولة من خلال فودافون كاش او انستا باي🤩🤍\nابعتلنا بس بياناتك وفريق المبيعات هيتواصل معاك للدفع والاشتراك:\n▫️الاسم:\n▫️رقم الموبايل:\n▫️السنة الدراسية:\nوبإذن الله هنساعدك في إتمام الاشتراك بكل سهولة 🥰"},
  {"title": "تأكيد كود فوري 97 — صلاحية يومين", "category": "دفع", "body": "الدفع بيكون على الكود اللي بيبدأ بـ  97، صحيح بإذن الله و بيكون صلاحيته لمدة يومين 🤍\nوبمجرد إتمام الدفع، هيتم تفعيل الحساب مباشرة بإذن الله."},
  {"title": "المشرفة هتتواصل — جروب المتابعة وحساب ولي الأمر", "category": "مميزات وأسئلة", "body": "هيتم التواصل معاك من قِبل المشرفة خلال الأسبوع الحالي، وهيتم إضافتك لجروب المتابعة وعمل حساب لولي الامر، وهتكون معاك خطوة بخطوة في تنظيم وقتك وتجهيز جدول دراسي مناسب ليك بإذن الله 🤍\n🤍🤍اطمن تمامًا"},
  {"title": "تأكيد البيانات — فودافون كاش (ضحى)", "category": "فودافون كاش", "body": "حابين نأكد مع حضرتك بيانات الاشتراك قبل إتمام الدفع 🤍\n📚 الباقة:\n 💰 سعر الاشتراك:\n 💳 طريقة الدفع:\nتقدر تحوّل على رقم فودافون كاش التالي (باسم ضحى)👇\n 01016058437\nوبعد التحويل، ياريت تبعتلنا صورة واضحة لعملية الدفع 📸، مع البيانات التالية:\n▫️اسم الطالب\n▫️رقم الطالب\n▫️رقم وليّ الأمر\n▫️السنة الدراسية والتخصص\n▫️اسم الباقة أو المواد المشترك فيها\n▫️الرقم اللي تم التحويل منه\nوبمجرد استلام البيانات وصورة الدفع، هنراجعها ونفعّل الاشتراك في أسرع وقت بإذن الله 🤍", "pinned": true},
  {"title": "المتجر — تحديث قريب لاستخدام العملات", "category": "معلومات عامة", "body": "هيكون متاح تحديث قريب جدًا، وهيتضاف فيه متجر تقدر تستخدم العملات من خلاله وتستفيد منها 🤍✨"},
  {"title": "خطوات الدفع بسيطة — متقلقش", "category": "دفع", "body": "ممكن نتبع الخطوات، ومتقلقش خالص 🤍\nخطوة الدفع بسيطة وسهلة، وإن شاء الله هتتم بكل سهولة 🤍🤍"},
  {"title": "البيانات المطلوبة بعد التحويل", "category": "فودافون كاش", "body": "ممكن تبعتلنا البيانات التالية:\n▫️اسم الطالب\n▫️رقم الطالب\n▫️رقم وليّ الأمر\n▫️السنة الدراسية والتخصص\n▫️اسم الباقة أو المواد المشترك فيها\n▫️الرقم اللي تم التحويل منه"},
  {"title": "نصيحة: تابع أكتر من حصة وحل التمارين", "category": "معلومات عامة", "body": "ممكن تتابع أكتر من حصة وكمان تحل التمارين والتدريبات باستمرار، وده هيساعد الطالب جدًا على استيعاب الشرح بشكل أفضل بإذن الله 🤍📚\nلأن الطالب بيحتاج وقت كافي لمتابعة الحصص والتطبيق على اللي اتشرح وحل التمارين، ومع الاستمرار والممارسة بيبدأ الشرح يكون أوضح وأسهل في الاستيعاب.\nوكمان معظم الطلاب اللي بيتابعوا مع المدرس بيكون عندهم آراء وتجارب إيجابية جدًا في طريقة الشرح، وبيشكروا في أسلوبه وقدرته على توصيل المعلومة بشكل مبسط. 🥰🤍\nفأنصحك تدي نفسك فرصة تتابع أكتر من حصة وتحاول تطبق وتحل التمارين، وإن شاء الله مع الوقت هتقدر تستوعب طريقة الشرح بشكل أفضل وتكون التجربة أوضح بالنسبة لها. 🙏🤍"},
  {"title": "الحصة شغالة — اتأكد من النت أو جهاز تاني", "category": "دعم فني", "body": "تمت مراجعة الحصة، وتعمل بشكل طبيعي بدون أي مشكلة 🤍\nبرجاء التأكد من جودة الإنترنت، وتجربة فتح الحصة من جهاز مختلف أو متصفح مختلف 🙏"},
  {"title": "الحساب شغال — سجل الدخول بنسخ الرقم", "category": "دعم فني", "body": "الحساب بيعمل بشكل كامل وبدون أي مشكلة 🤍\nبرجاء التأكد من تسجيل الدخول باستخدام البيانات المرسلة بشكل صحيح.\n📌 ولتسجيل الدخول بدون أي خطأ، برجاء نسخ الرقم المرسل لك ولصقه مرة في خانة رقم الموبايل، ومرة أخرى في خانة كلمة المرور.\nوبإذن الله هتقدر تدخل على الحساب بشكل طبيعي 🤍"},
  {"title": "الحصة اترفعت مؤقتاً للتعديل — هترجع قريب", "category": "دعم فني", "body": "تم رفعها مؤقتًا من على المنصة لإجراء بعض التعديلات وتحسين جودة المحتوى، وهتكون متاحة من جديد قريب جدًا بإذن الله. 🤍\nاطمن تمامًا، وبمجرد الانتهاء من التعديلات هتقدر توصل لها بشكل طبيعي. 🙏🤍"},
  {"title": "الاشتراك الشهري — 30 يوم والحجب والتجديد", "category": "قواعد", "body": "الاشتراك الشهري بيكون لمدة 30 يوم\nمع انتهاء الـ 30 يوم يتم حجب الحصص مؤقتاً لحين تجديد الاشتراك،\nبمجرد تجديد الاشتراك مرة أخرى تكون جميع الحصص الموجودة على المنصة متاحة ليك من جديد 🤍"},
  {"title": "اشتراك الترم منفصل عن اشتراك الشهر", "category": "قواعد", "body": "هو تم الاستفادة بالفعل من اشتراك الشهر، فاشتراك الترم بيكون منفصل عن اشتراك الشهر، وبالتالي بيتم الاشتراك في باقة الترم بشكل مستقل. 🤍"},
  {"title": "مفيش كورسات تأسيس أو قراءة وكتابة", "category": "قواعد", "body": "حاليًا، مش متاح على المنصة كورسات لتعليم القراءة والكتابة او اللغة الانجليزية أو التأسيس لأي مادة، لكن المتاح هو شرح المنهج الدراسي الخاص بالطالب، بما يتوافق مع مقررات وزارة التربية والتعليم للسنة الدراسية بتاعته. 🤍📚"},
  {"title": "ابعتلنا فيديو للشاشة يوضح المشكلة", "category": "دعم فني", "body": "ممكن تبعتلنا فيديو للشاشة يوضح المشكلة اللي بتظهر لك، علشان نقدر نحدد سبب المشكلة بدقة ونساعدك في حلها بأسرع وقت ممكن. 🤍🙏"},
  {"title": "تم حل المشكلة بنجاح", "category": "دعم فني", "body": "تم حل المشكلة بنجاح 🤍"},
  {"title": "سجل خروج وادخل تاني عشان التعديلات تظهر", "category": "دعم فني", "body": "برجاء تسجيل الخروج من المنصة، ثم تسجيل الدخول مرة أخرى، حتى تظهر التعديلات عندك وتقدر تستخدم المنصة بشكل طبيعي. 🙏\n\nنقدر نساعدك في أي حاجة تانية؟ 🤩"},
  {"title": "الصور مش ظاهرة — إعادة ضبط DNS", "category": "دعم فني", "body": "📌 لو الصور أو السؤال مش ظاهرة عندك على المنصة، بتكون المشكلة مرتبطة بإعدادات شبكة الإنترنت المستخدمة.\n\nبرجاء التواصل مع شركة الإنترنت (الواي فاي) وطلب إعادة ضبط إعدادات الـ DNS (DNS Reset)، لأن المشكلة ممكن تكون من الشبكة نفسها، مش من المنصة.\n\nوبعد تنفيذ الخطوة دي، جرّب الدخول على المنصة مرة تانية، وإن شاء الله الصور تظهر بشكل طبيعي. 🤍"},
  {"title": "استفسارك عن اشتراك الطلاب ولا الوظائف؟", "category": "مميزات وأسئلة", "body": "مكن أعرف استفسارك بخصوص الاشتراك للطلاب، ولا بخصوص التقديم على الوظائف؟ 🤍"},
  {"title": "مواعيد نزول الحصص — حصة أو حصتين أسبوعياً", "category": "مواعيد", "body": "مواعيد الحصص بتكون بشكل تدريجي حصة أو حصتين خلال الاسبوع بمواعيد محددة مكتوبة تحت كل حصة\nلما الطالب بيدخل في الوقت و التاريخ المحدد بيلاقي الحصة موجودة ويقدر يتابعها في أي وقت مناسب له 🤍"},
  {"title": "مدرسين رابع ابتدائي — عام", "category": "مدرسين", "body": "🟡 المرحلة الإبتدائية\nالصف الرابع الابتدائي – عام\n\n\n📚 أسماء المدرسين للصف الرابع الابتدائي (عام)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n🔗 https://screenrec.com/share/Du8v9CEabi\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين رابع ابتدائي — لغات", "category": "مدرسين", "body": "الصف الرابع الابتدائي – لغات\n\n\n📚 أسماء المدرسين للصف الرابع الابتدائي (لغات)\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/5dTQCBrqo4\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين خامس ابتدائي — عام", "category": "مدرسين", "body": "الصف الخامس الابتدائي – عام\n\n\n📚 أسماء المدرسين للصف الخامس الابتدائي (عام)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/4NIo2fwdX9\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين خامس ابتدائي — لغات", "category": "مدرسين", "body": "الصف الخامس الابتدائي – لغات\n\n\n📚 أسماء المدرسين للصف الخامس الابتدائي (لغات)\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/qjSxo6HaWE\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين سادس ابتدائي — عام", "category": "مدرسين", "body": "الصف السادس الابتدائي – عام\n\n\n📚 أسماء المدرسين للصف السادس الابتدائي (عام)\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/w4COhdDsLE\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين سادس ابتدائي — لغات", "category": "مدرسين", "body": "الصف السادس الابتدائي – لغات\n\n\n📚 أسماء المدرسين للصف السادس الابتدائي (لغات)\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/of6DucWEgS\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين أول إعدادي — عام", "category": "مدرسين", "body": "🟢 المرحلة الإعدادية\nالصف الأول الإعدادي – عام\n\n\n📚 أسماء المدرسين للصف الأول الإعدادي (عام)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الروابط التالية:\n\n\n🔗 https://screenrec.com/share/Q8EMJWtTfy\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين أول إعدادي — لغات", "category": "مدرسين", "body": "الصف الأول الإعدادي – لغات\n\n\n📚 أسماء المدرسين للصف الأول الإعدادي (لغات)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الروابط التالية:\n\n\n🔗 https://screenrec.com/share/p8k9QojTit\n 🔗 https://screenrec.com/share/HOeZgIqc45\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين تاني إعدادي — عام", "category": "مدرسين", "body": "الصف الثاني الإعدادي – عام\n\n\n📚 أسماء المدرسين للصف الثاني الإعدادي (عام)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الروابط التالية:\n\n\n🔗 https://screenrec.com/share/cIhSQMmVNF\n 🔗 https://screenrec.com/share/rUvVAkLzlQ\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين تاني إعدادي — لغات", "category": "مدرسين", "body": "الصف الثاني الإعدادي – لغات\n\n\n📚 أسماء المدرسين للصف الثاني الإعدادي (لغات)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الروابط التالية:\n\n\n🔗 https://screenrec.com/share/GnMdP5huRe\n 🔗 https://screenrec.com/share/2sCyUftRQA\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين تالت إعدادي — عام", "category": "مدرسين", "body": "الصف الثالث الإعدادي – عام\n\n\n📚 أسماء المدرسين للصف الثالث الإعدادي (عام)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n\n🔗 https://screenrec.com/share/TSl5uqn6pG\n\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "مدرسين تالت إعدادي — لغات", "category": "مدرسين", "body": "الصف الثالث الإعدادي – لغات\n\n\n📚 أسماء المدرسين للصف الثالث الإعدادي (لغات)\n\n\nتقدر تتعرف على أسماء المدرسين المتاحين لكل مادة والمواد اللي بيشرحها كل مدرس، من خلال الرابط التالي:\n\n🔗 https://screenrec.com/share/bg29AuhRwl\n\n📌 ملحوظة مهمة:\n لو المادة متاح لها أكثر من مدرس، بيكون متاح ليك متابعة جميع المدرسين المتاحين للمادة بمجرد الاشتراك فيها، ومش بتحتاج تشترك مع كل مدرس بشكل منفصل. 🤍"},
  {"title": "المواد والباقات المتاحة — المرحلة الثانوية", "category": "معلومات عامة", "body": "🔵 المرحلة الثانوية\n\n\n\n📚 المواد والباقات المتاحة حاليًا\n🎓 الصف الأول الثانوي (أولى بكالوريا)\n✅ جميع المواد متاحة على المنصة (عربي ولغات)، ما عدا اللغة الإيطالية.\n ✅ باقة الخطة كلاس متاحة لجميع المواد.\n\n🎓 الصف الثاني الثانوي\n✅ جميع المواد متاحة على المنصة (عربي ولغات)، ما عدا اللغة الإيطالية.\n ❌ باقة الخطة كلاس غير متاحة.\n\n🎓 الصف الثالث الثانوي\n🔹 علمي رياضة (عام)\n✅ جميع المواد متاحة، ما عدا الكيمياء واللغة الثانية.\n ❌ باقة الخطة كلاس غير متاحة.\n🔹 علمي رياضة (لغات)\n✅ جميع المواد متاحة، ما عدا مادة Math واللغة الثانية.\n ❌ باقة الخطة كلاس غير متاحة.\n🔹 علمي علوم (عام)\n✅ جميع المواد متاحة، ما عدا الكيمياء واللغة الثانية.\n ❌ باقة الخطة كلاس غير متاحة.\n🔹 علمي علوم (لغات)\n✅ جميع المواد متاحة، ما عدا اللغة الثانية.\n ✅ باقة الخطة كلاس متاحة.\n🔹 أدبي (عام)\n✅ جميع المواد متاحة، ما عدا اللغة الثانية.\n ✅ باقة الخطة كلاس متاحة.\n🔹 أدبي (لغات)\n✅ جميع المواد متاحة، ما عدا اللغة الثانية.\n ✅ باقة الخطة كلاس متاحة.\n\n📝 ملاحظات مهمة\nالصف الأول الثانوي هو أولى بكالوريا، ونفس المواد.\nالصف الثالث الثانوي للعام الدراسي 2026/2027 سيكون بالنظام العام، وليس نظام البكالوريا.\nيعني لا يوجد نظام بكالوريا للصف الثالث الثانوي هذا العام.\n📌 أنظمة اشتراك الصف الثالث الثانوي\n📅 اشتراك شهري\n📅 اشتراك 3 شهور (90 يوم)\n📅 اشتراك سنوي"},
  {"title": "أول حصة 29/8 — الاستثناءات ومواعيد البداية", "category": "مواعيد", "body": "📚 أول حصة هتكون متاحة على الموقع يوم 29/8 لجميع مراحل النقل من الصف الرابع الابتدائي وحتى الصف الأول الثانوي، باستثناء المواد التالية، وهيتم تحديد موعدها لاحقًا لحين توفر المنهج أو المصادر:\nساينس 4، 5، 6 ابتدائي.\nرياضة وماث 1 ثانوي.\nعلوم متكاملة عام ولغات 1 ثانوي.\nماث 3 إعدادي.\nساينس 3 إعدادي.\n📅 مواد هيتم تأجيل بداية المحتوى فيها لمدة أسبوع، وأول حصة هتكون يوم 5/9:\nإنجليزي 4، 5، 6 ابتدائي.\n🎓 مواد البكالوريا:\nمفيش موعد محدد لبدء المحتوى حاليًا، لحين نزول المناهج من المصدر الأصلي، وبعدها هيتم تحديد الموعد والإعلان عنه.\n🤍 ياريت ناخد بالنا من المواعيد دي عند الرد على أي استفسارات من الطلاب أو أولياء الأمور."},
  {"title": "مواعيد بداية السنة الدراسية", "category": "مواعيد", "body": "📅 مواعيد بداية السنة الدراسية\n\n🟢 من الصف الرابع الابتدائي حتى الصف الأول الثانوي\n📌 البداية: 29/8\n\n✨مع استثناء المواد التالية لحين توفر المنهج أو المصادر:\n▫️ساينس 4، 5، 6 ابتدائي\n▫️ ماث ورياضة 1 ثانوي\n▫️ علوم متكاملة عام ولغات 1 ثانوي\n▫️ ماث 3 إعدادي\n▫️ ساينس 3 إعدادي\n\n🟡 إنجليزي 4، 5، 6 ابتدائي\n📌 البداية: 5/9\n\n▫️تم تأجيل أول حصة لمدة أسبوع.\n\n🔵 مواد البكالوريا\n📌 لم يتم تحديد موعد البداية حتى الآن\n\n▫️وسيتم تحديد الموعد فور نزول المناهج من المصدر الأصلي. 🤍"},
  {"title": "تعريف الخطة التعليمية — المراحل المتاحة", "category": "مميزات وأسئلة", "body": "❤️ الخطة التعليمية\nمنصة تعليمية متخصصة في شرح مناهج وزارة التربية والتعليم، وبتوفر لك تجربة تعليم أونلاين متكاملة من البيت. 📚\n\n\n🎓 المراحل المتاحة:\n🔹 الابتدائي:\nالصف الرابع – الخامس – السادس | عام ولغات\n\n\n🔹 الإعدادي:\nالصف الأول – الثاني – الثالث | عام ولغات\n\n\n🔹 الثانوي:\nالصف الأول – الثاني – الثالث | عام ولغات\nالصف الثاني الثانوي – نظام البكالوريا\n\n\n🎯 هدفنا:\nتوفير تجربة تعليمية مميزة ومتكاملة تساعدك تحقق أفضل استفادة ممكنة. 🤍\n\n\n🌐 موقع الخطة:\nelkheta.com"},
  {"title": "خاص بالتفعيل", "category": "معلومات عامة", "body": "خاص بالتفعيل \n\nGEOGRAPHY \nIntegrated Sciences\nPSYCHOLOGY\nPHILOSOPHY \nابجريد للاشتراك\nخصم اخوات \nAll Subjects"},
  {"title": "الحصص مسجلة — تراجع الشرح أكتر من مرة", "category": "مميزات وأسئلة", "body": "الحصص بتكون مسجلة وده بيكون أفضل ليك لأنك هتكون قادر تراجع شرح المدرس اكتر من مرة 🤩"},
  {"title": "أول حصة مجانية من كل مادة — خطوات التجربة", "category": "معلومات عامة", "body": "بيكون متاح أول حصة مجانية من كل مادة تقدر تشوفها قبل الاشتراك 💖\n\n\nلو حابب تجرب:\n1- ادخل على: https://elkheta.com/\n2- اختر \"إنشاء حساب جديد\"\n3- سجل بياناتك\n\nوجرب المحتوى و الشرح قبل ما تشترك 😍🤍"},
);

async function seedForUser(ctx: Ctx, userId: number): Promise<number> {
  const db = ctx.db<typeof schema>();
  const existing = await db
    .select({ id: schema.shortcuts.id })
    .from(schema.shortcuts)
    .where(eq(schema.shortcuts.userId, userId))
    .limit(1);
  if (existing.length > 0) return 0;
  for (const item of SEED) {
    await db.insert(schema.shortcuts).values({
      userId,
      title: item.title,
      body: item.body,
      category: item.category,
      pinned: item.pinned ?? false,
    });
  }
  return SEED.length;
}

/* ================= starter library (owner-chosen) =================
   The owner picks the starter set from his OWN library in the UI
   (Shortcuts section, owner only) — no starter reply is ever
   invented here. The choice is one site_config entry
   ("starter_library": JSON array of the owner's shortcut ids, in
   the order he picked them). On every new-account registration the
   chosen replies are copied into the new user's own library as
   their own rows (their own user_id, fresh usage counters, no
   folder — the category name travels with the reply). Existing
   accounts are never touched, and until the owner picks a set the
   value is absent and new accounts start with the guided empty
   state. No new table: site_config already exists. */

const STARTER_LIBRARY_KEY = "starter_library";

/** The site owner — the first account, the same convention as
    exportFullBackup / resetUsageStats / importContentPackForOwner. */
async function getOwnerId(ctx: Ctx): Promise<number | null> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .orderBy(asc(schema.users.id))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Throws unless the caller is the owner (first account). */
async function requireOwner(ctx: Ctx, me: UserRow): Promise<number> {
  const ownerId = await getOwnerId(ctx);
  if (!ownerId || ownerId !== me.id) {
    throw new Error("مكتبة البداية متاحة لحساب صاحب الموقع بس");
  }
  return ownerId;
}

/** The owner's chosen starter ids, in his order — [] when nothing
    was chosen yet, or the stored value is corrupt. */
async function readStarterLibraryIds(ctx: Ctx): Promise<number[]> {
  const db = ctx.db<typeof schema>();
  const rows = await db
    .select({ value: schema.siteConfig.value })
    .from(schema.siteConfig)
    .where(eq(schema.siteConfig.key, STARTER_LIBRARY_KEY))
    .limit(1);
  const raw = rows[0]?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is number =>
        typeof x === "number" && Number.isInteger(x) && x > 0,
    );
  } catch {
    return [];
  }
}

/** Copies the owner's chosen starter replies into a brand-new
    account's own library. Returns how many were copied (0 when no
    set was chosen yet, or the new account IS the owner — he never
    seeds from himself). The copies are the new user's own rows:
    usage counters start at zero and the replies are theirs to edit
    or delete; the owner's rows are never touched. */
async function seedStarterLibraryForUser(
  ctx: Ctx,
  userId: number,
): Promise<number> {
  const db = ctx.db<typeof schema>();
  const ownerId = await getOwnerId(ctx);
  if (!ownerId || ownerId === userId) return 0;
  const ids = await readStarterLibraryIds(ctx);
  if (ids.length === 0) return 0;
  const src = await db
    .select()
    .from(schema.shortcuts)
    .where(
      and(
        eq(schema.shortcuts.userId, ownerId),
        inArray(schema.shortcuts.id, ids),
        isNull(schema.shortcuts.deletedAt),
      ),
    );
  const byId = new Map(src.map((r) => [r.id, r]));
  let n = 0;
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    await db.insert(schema.shortcuts).values({
      userId,
      title: r.title,
      body: r.body,
      category: r.category,
      tags: r.tags,
      trigger: r.trigger,
      extShortcut: r.extShortcut,
      source: r.source,
      pinned: r.pinned,
      favorite: r.favorite,
    });
    n += 1;
  }
  return n;
}

/* ================= actions ================= */

export const Actions = {
  register: defineAction({
    description:
      "Creates a new IS account with full name, email and password (Egyptian mobile optional), and signs the user in.",
    request: z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().min(5).max(120),
      phone: z.string().trim().max(20).optional().default(""),
      password: z.string().min(1).max(100),
    }),
    response: authResult,
    handler: async (ctx, args): Promise<z.infer<typeof authResult>> => {
      const db = ctx.db<typeof schema>();
      const email = normalizeEmail(args.email);
      if (!isValidEmail(email)) {
        return {
          ok: false,
          token: null,
          user: null,
          error: "البريد الإلكتروني مش صحيح — اكتبه بالشكل name@example.com",
        };
      }
      const byEmail = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      if (byEmail.length > 0) {
        return {
          ok: false,
          token: null,
          user: null,
          error: "البريد ده مسجل قبل كده — سجّل دخولك بدل ما تعمل حساب جديد",
        };
      }
      // Mobile stays optional: when given it must be a valid Egyptian
      // number that no other account owns; when omitted the account is
      // email-only (phone stays NULL).
      let phone: string | null = null;
      if (args.phone.trim().length > 0) {
        phone = normalizePhone(args.phone);
        if (!isValidPhone(phone)) {
          return {
            ok: false,
            token: null,
            user: null,
            error: "رقم الموبايل مش صحيح — اكتب رقم مصري بيبدأ بـ 01 وطوله 11 رقم، أو سيبه فاضي",
          };
        }
        const byPhone = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.phone, phone))
          .limit(1);
        if (byPhone.length > 0) {
          return {
            ok: false,
            token: null,
            user: null,
            error: "رقم الموبايل ده مسجل قبل كده — سجّل دخولك بدل ما تعمل حساب جديد",
          };
        }
      }
      const passwordHash = await hashPassword(args.password);
      const inserted = await db
        .insert(schema.users)
        .values({ name: args.name, email, phone, passwordHash })
        .returning();
      const user = inserted[0];
      if (!user) throw new Error("register: insert returned no rows");
      await claimLegacyShortcuts(ctx, user.id);
      // Only the very first account on a fresh install is bootstrapped with
      // the starter pack automatically; later accounts start empty and can
      // load the pack deliberately via loadStarterPack.
      const allUsers = await db.select({ id: schema.users.id }).from(schema.users);
      if (allUsers.length === 1) {
        await seedForUser(ctx, user.id);
      }
      /* Every new account also starts with the owner's chosen starter
         library when he has picked one (copies of his replies, as
         the new user's own rows); when nothing is chosen yet this
         copies nothing and the account starts with the guided empty
         state. Existing accounts are never touched. */
      await seedStarterLibraryForUser(ctx, user.id);
      const token = await createSession(ctx, user.id);
      ctx.invalidateQueries();
      return { ok: true, token, user: await toUserShape(ctx, user), error: null };
    },
  }),

  login: defineAction({
    description:
      "Signs in an existing IS account with email OR Egyptian mobile number, plus password.",
    request: z.object({
      identifier: z.string().trim().min(3).max(120),
      password: z.string().min(1).max(100),
    }),
    response: authResult,
    handler: async (ctx, args): Promise<z.infer<typeof authResult>> => {
      const db = ctx.db<typeof schema>();
      // One field, two routes: an "@" means email, anything else is
      // treated as a mobile number and normalized the same way register
      // stored it — so every legacy phone-only account keeps signing in
      // exactly as before.
      const raw = args.identifier.trim();
      const rows = raw.includes("@")
        ? await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, normalizeEmail(raw)))
            .limit(1)
        : await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.phone, normalizePhone(raw)))
            .limit(1);
      const user = rows[0];
      if (!user || !(await verifyPassword(args.password, user.passwordHash))) {
        return {
          ok: false,
          token: null,
          user: null,
          error: "بيانات الدخول غلط — راجع البريد أو رقم الموبايل وكلمة المرور وحاول تاني",
        };
      }
      await claimLegacyShortcuts(ctx, user.id);
      const token = await createSession(ctx, user.id);
      ctx.invalidateQueries();
      return { ok: true, token, user: await toUserShape(ctx, user), error: null };
    },
  }),

  /* One-time access restore, run once by the platform at the account
     owner's own request after he stated the exact email and password
     he registered with and no digit-shape variant of that password
     matched the stored hash (his password had evidently been changed
     away from the registered one). Three locks keep it a single-use
     bridge and never a standing backdoor: the caller must present a
     one-time key whose SHA-256 is embedded below (the key itself
     exists nowhere in the code or the client), the restore is
     recorded in site_config and can never run a second time, and it
     can only set the password of the account named by email. Every
     existing session stays valid; nothing else about the account —
     replies, folders, history — is touched. */
  restoreOwnerAccess: defineAction({
    description:
      "One-time, key-guarded restore that sets the password of the account named by email to the password its owner provided, then permanently disables itself.",
    request: z.object({
      email: z.string().trim().min(5).max(120),
      password: z.string().min(1).max(100),
      key: z.string().min(1).max(200),
    }),
    response: z.object({ restored: z.boolean() }),
    handler: async (
      ctx,
      args,
    ): Promise<{ restored: boolean }> => {
      const KEY_SHA256 =
        "f7c973c290320fd015170aada84f411078890e6d4d9e5307b1b5d67355199c3e";
      if ((await sha256Hex(args.key)) !== KEY_SHA256) {
        return { restored: false };
      }
      const db = ctx.db<typeof schema>();
      const used = await db
        .select({ key: schema.siteConfig.key })
        .from(schema.siteConfig)
        .where(eq(schema.siteConfig.key, "owner_access_restore_v1"))
        .limit(1);
      if (used.length > 0) return { restored: false };
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, normalizeEmail(args.email)))
        .limit(1);
      const user = rows[0];
      if (!user) return { restored: false };
      const passwordHash = await hashPassword(args.password);
      await db
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, user.id));
      await db.insert(schema.siteConfig).values({
        key: "owner_access_restore_v1",
        value: new Date().toISOString(),
      });
      ctx.invalidateQueries();
      return { restored: true };
    },
  }),

  setEmail: defineAction({
    description:
      "Sets or changes the signed-in user's login email (used to sign in and shown in their account).",
    request: z.object({
      token: z.string(),
      email: z.string().trim().min(5).max(120),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const email = normalizeEmail(args.email);
      if (!isValidEmail(email)) {
        return { ok: false, error: "البريد الإلكتروني مش صحيح — اكتبه بالشكل name@example.com" };
      }
      const clash = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);
      const other = clash[0];
      if (other && other.id !== me.id) {
        return { ok: false, error: "البريد ده مربوط بحساب تاني — استخدم بريد آخر" };
      }
      await db
        .update(schema.users)
        .set({ email, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  logout: defineAction({
    description: "Signs out the current session on this device only.",
    request: z.object({ token: z.string() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.token, args.token));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  logoutAll: defineAction({
    description:
      "Signs the user out on every device at once by deleting all of their sessions.",
    request: z.object({ token: z.string() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, me.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  me: defineAction({
    description: "Returns the signed-in user for a session token, or null.",
    request: z.object({ token: z.string() }),
    response: z.object({ user: userShape.nullable() }),
    async handler(ctx, args) {
      const user = await getSessionUser(ctx, args.token);
      if (user) await claimLegacyShortcuts(ctx, user.id);
      return { user: user ? await toUserShape(ctx, user) : null };
    },
  }),

  updateProfile: defineAction({
    description: "Updates the signed-in user's display name.",
    request: z.object({
      token: z.string(),
      name: z.string().trim().min(2).max(80),
    }),
    response: z.object({ user: userShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await db
        .update(schema.users)
        .set({ name: args.name, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, me.id))
        .limit(1);
      const user = rows[0];
      if (!user) throw new Error("updateProfile: user vanished");
      ctx.invalidateQueries();
      return { user: await toUserShape(ctx, user) };
    },
  }),

  setAvatar: defineAction({
    description:
      "Sets the signed-in user's profile picture from an uploaded image (already downscaled by the client). Stored as an owned blob on the account, so it syncs to every device.",
    request: z.object({
      token: z.string(),
      /* ~2 MB of image bytes once decoded; the client downscales to
         at most 512px before sending, so real uploads are far below
         this ceiling — it exists to reject abuse, not real photos. */
      dataBase64: z.string().min(1).max(2_800_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }),
    response: z.object({ user: userShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const bytes = Buffer.from(args.dataBase64, "base64");
      if (bytes.length === 0 || bytes.length > 2_000_000) {
        throw new Error("الصورة كبيرة أو فاضية — جرّب صورة أصغر");
      }
      const key = `avatars/${me.id}`;
      await ctx.blobs.put(key, bytes, { contentType: args.mimeType });
      await db
        .update(schema.users)
        .set({ avatarBlobKey: key, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, me.id))
        .limit(1);
      const user = rows[0];
      if (!user) throw new Error("setAvatar: user vanished");
      ctx.invalidateQueries();
      return { user: await toUserShape(ctx, user) };
    },
  }),

  removeAvatar: defineAction({
    description:
      "Removes the signed-in user's profile picture; the account falls back to showing the name's first letter.",
    request: z.object({ token: z.string() }),
    response: z.object({ user: userShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (me.avatarBlobKey) {
        try {
          await ctx.blobs.delete(me.avatarBlobKey);
        } catch {
          /* The column is cleared either way; an orphaned blob is
             harmless and must not block the removal. */
        }
      }
      await db
        .update(schema.users)
        .set({ avatarBlobKey: null, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, me.id))
        .limit(1);
      const user = rows[0];
      if (!user) throw new Error("removeAvatar: user vanished");
      ctx.invalidateQueries();
      return { user: await toUserShape(ctx, user) };
    },
  }),

  /* ================= reply media =================
     The file itself is uploaded straight from the browser to
     Vercel Blob (app/api/media/upload mints a short-lived token
     after checking ownership); these actions only record or drop
     the reference. attachMedia re-validates EVERYTHING server-side
     — ownership, kind/content-type pair, size caps, pathname shape
     and the Blob host — so a forged client call can never point a
     reply at an arbitrary URL or another user's file. */

  attachMedia: defineAction({
    description:
      "Attaches an already-uploaded image or video (Vercel Blob) to one of the signed-in user's own replies, replacing any media it already had. Re-validates kind, content type, size, pathname shape and Blob host server-side.",
    request: z.object({
      token: z.string(),
      shortcutId: z.number().int().positive(),
      kind: z.enum(["image", "video"]),
      blobUrl: z.string().min(1).max(500),
      blobPathname: z.string().min(1).max(300),
      contentType: z.string().min(1).max(100),
      byteSize: z.number().int().positive(),
      width: z.number().int().positive().nullable().optional(),
      height: z.number().int().positive().nullable().optional(),
      durationMs: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ media: mediaShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.shortcutId);
      const limits = mediaLimitsFor(args.kind);
      if (
        !(limits.contentTypes as readonly string[]).includes(args.contentType)
      ) {
        throw new Error("نوع الملف ده مش مدعوم — الصور JPG/PNG/WebP والفيديو MP4/WebM بس");
      }
      if (args.byteSize > limits.maxBytes) {
        throw new Error(
          args.kind === "image"
            ? "الصورة أكبر من 8 ميجا — جرّب صورة أصغر"
            : "الفيديو أكبر من 50 ميجا — جرّب فيديو أصغر",
        );
      }
      if (
        args.kind === "video" &&
        args.durationMs !== undefined &&
        args.durationMs !== null &&
        args.durationMs > MEDIA_VIDEO_MAX_DURATION_MS
      ) {
        throw new Error("الفيديو أطول من 5 دقايق — جرّب فيديو أقصر");
      }
      /* Pathname must be ours: media/<my id>/<this reply>/<uuid>.<ext>. */
      const pm = MEDIA_PATH_RE.exec(args.blobPathname);
      if (
        !pm ||
        Number(pm[1]) !== me.id ||
        Number(pm[2]) !== args.shortcutId
      ) {
        throw new Error("مسار الملف مش صحيح");
      }
      /* URL must be a Vercel Blob public URL for exactly this pathname. */
      let url: URL;
      try {
        url = new URL(args.blobUrl);
      } catch {
        throw new Error("رابط الملف مش صحيح");
      }
      if (
        url.protocol !== "https:" ||
        !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
        decodeURIComponent(url.pathname) !== `/${args.blobPathname}`
      ) {
        throw new Error("رابط الملف مش من مخزن الموقع");
      }
      const values = {
        shortcutId: args.shortcutId,
        userId: me.id,
        kind: args.kind,
        blobUrl: args.blobUrl,
        blobPathname: args.blobPathname,
        contentType: args.contentType,
        byteSize: args.byteSize,
        width: args.width ?? null,
        height: args.height ?? null,
        durationMs: args.durationMs ?? null,
      };
      const existing = await db
        .select()
        .from(schema.replyMedia)
        .where(eq(schema.replyMedia.shortcutId, args.shortcutId))
        .limit(1);
      const old = existing[0] ?? null;
      let saved: MediaRow[];
      if (old) {
        saved = await db
          .update(schema.replyMedia)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.replyMedia.id, old.id))
          .returning();
      } else {
        saved = await db.insert(schema.replyMedia).values(values).returning();
      }
      const row = saved[0];
      if (!row) throw new Error("attachMedia: save returned no rows");
      /* Replace order: the new row is committed first, so a failure
         here can never leave the reply media-less; the old Blob
         object is dropped only when nothing still references it. */
      if (old && old.blobPathname !== args.blobPathname) {
        await deleteBlobsIfUnreferenced(ctx, [old.blobPathname]);
      }
      ctx.invalidateQueries();
      return { media: toMediaShape(row) };
    },
  }),

  removeMedia: defineAction({
    description:
      "Removes the image/video attached to one of the signed-in user's own replies and deletes the Blob object when no other reply still references it.",
    request: z.object({
      token: z.string(),
      shortcutId: z.number().int().positive(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.shortcutId);
      const existing = await db
        .select()
        .from(schema.replyMedia)
        .where(eq(schema.replyMedia.shortcutId, args.shortcutId))
        .limit(1);
      const old = existing[0] ?? null;
      if (!old) throw new Error("الرد ده مفيهوش صورة أو فيديو");
      await db
        .delete(schema.replyMedia)
        .where(eq(schema.replyMedia.id, old.id));
      await deleteBlobsIfUnreferenced(ctx, [old.blobPathname]);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  exportFullBackup: defineAction({
    description:
      "Builds the FULL backup for moving the whole site to a new host: every table (accounts with password hashes, folders with all settings, replies with all fields, favorites and trash state, smart folders, copy history, site config, reply media references) serialized in exactly the full-export shape scripts/import-backup.ts --full imports, plus each profile picture's URL and type so the client can embed its bytes in the downloaded file. Media rows carry URLs only — the bytes are NOT embedded (a single 50 MB video would make the backup un-downloadable). Owner account only (the first account) — the file carries every account's password hash, so it must be kept private. Sessions are never exported: a host move signs everyone out.",
    request: z.object({ token: z.string() }),
    response: z.object({
      filename: z.string(),
      json: z.string(),
      avatars: z.array(
        z.object({ userId: z.number(), mimeType: z.string(), url: z.string() }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      /* The file carries every account's password hash, so it is
         restricted to the site owner — the first account, the
         same convention importContentPackForOwner uses. Any
         other signed-in account is refused. */
      const firstRows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .orderBy(asc(schema.users.id))
        .limit(1);
      const first = firstRows[0];
      if (!first || first.id !== me.id) {
        throw new Error("النسخة الكاملة متاحة لحساب صاحب الموقع بس");
      }
      const iso = (d: Date | null | undefined): string | null =>
        d ? d.toISOString() : null;
      const [userRows, folderRows, shortcutRows, historyRows, smartRows, configRows, mediaRows] =
        await Promise.all([
          db.select().from(schema.users),
          db.select().from(schema.folders),
          db.select().from(schema.shortcuts),
          db.select().from(schema.copyHistory),
          db.select().from(schema.smartFolders),
          db.select().from(schema.siteConfig),
          db.select().from(schema.replyMedia),
        ]);
      /* Profile pictures live in blob storage, which exposes URLs
         but no byte read to actions: the client fetches each URL
         and embeds the bytes as dataBase64 in the final file, in
         exactly the { userId, mimeType, dataBase64 } shape the
         importer expects. */
      const avatars: Array<{ userId: number; mimeType: string; url: string }> = [];
      for (const u of userRows) {
        if (!u.avatarBlobKey) continue;
        const head = await ctx.blobs.head(u.avatarBlobKey);
        avatars.push({
          userId: u.id,
          mimeType: head?.contentType ?? "image/jpeg",
          url: await ctx.blobs.getUrl(u.avatarBlobKey),
        });
      }
      const data = {
        format: "is-full-export",
        version: 1,
        exportedAt: new Date().toISOString(),
        users: userRows.map((u) => ({
          id: u.id,
          name: u.name,
          phone: u.phone,
          googleEmail: u.googleEmail,
          email: u.email,
          passwordHash: u.passwordHash,
          avatarBlobKey: u.avatarBlobKey,
          createdAt: iso(u.createdAt),
          updatedAt: iso(u.updatedAt),
        })),
        folders: folderRows.map((f) => ({
          id: f.id,
          userId: f.userId,
          name: f.name,
          icon: f.icon,
          iconColor: f.iconColor,
          source: f.source,
          isSourceMain: f.isSourceMain,
          parentId: f.parentId,
          pinned: f.pinned,
          deletedAt: iso(f.deletedAt),
          description: f.description,
          sortOrder: f.sortOrder,
          createdAt: iso(f.createdAt),
          updatedAt: iso(f.updatedAt),
        })),
        shortcuts: shortcutRows.map((s) => ({
          id: s.id,
          userId: s.userId,
          title: s.title,
          body: s.body,
          category: s.category,
          tags: s.tags,
          trigger: s.trigger ?? "",
          extShortcut: s.extShortcut,
          source: s.source,
          folderId: s.folderId,
          sortOrder: s.sortOrder,
          pinned: s.pinned,
          favorite: s.favorite,
          deletedAt: iso(s.deletedAt),
          usageCount: s.usageCount,
          lastUsedAt: iso(s.lastUsedAt),
          createdAt: iso(s.createdAt),
          updatedAt: iso(s.updatedAt),
        })),
        copyHistory: historyRows.map((h) => ({
          id: h.id,
          userId: h.userId,
          shortcutId: h.shortcutId,
          title: h.title,
          copiedAt: iso(h.copiedAt),
        })),
        /* Sessions are deliberately NOT transplanted: a host
           move signs every account out, and each person signs in
           again on the new host with the same email/phone and
           password (the hashes above make that work). Live
           session tokens never leave the server. The key stays
           so the file's shape matches the importer's full mode. */
        sessions: [] as Array<never>,
        smartFolders: smartRows.map((f) => ({
          id: f.id,
          userId: f.userId,
          name: f.name,
          icon: f.icon,
          iconColor: f.iconColor,
          tags: f.tags,
          folderId: f.folderId,
          pinnedOnly: f.pinnedOnly,
          favoriteOnly: f.favoriteOnly,
          minUses: f.minUses,
          unusedDays: f.unusedDays,
          sortOrder: f.sortOrder,
          createdAt: iso(f.createdAt),
          updatedAt: iso(f.updatedAt),
        })),
        siteConfig: configRows.map((c) => ({ key: c.key, value: c.value })),
        /* Reply media: URLs only, never bytes — a single 50 MB
           video would make the backup un-downloadable. The importer
           restores the rows; a URL that 404s at render time shows a
           "media unavailable" placeholder, never a broken image. */
        media: mediaRows.map((m) => ({
          id: m.id,
          shortcutId: m.shortcutId,
          userId: m.userId,
          kind: m.kind,
          blobUrl: m.blobUrl,
          blobPathname: m.blobPathname,
          contentType: m.contentType,
          byteSize: m.byteSize,
          width: m.width,
          height: m.height,
          durationMs: m.durationMs,
          createdAt: iso(m.createdAt),
          updatedAt: iso(m.updatedAt),
        })),
        /* Filled in by the client with dataBase64 before download. */
        avatars: [] as Array<{ userId: number; mimeType: string; dataBase64: string }>,
      };
      return {
        filename: "is-full-backup.json",
        json: JSON.stringify(data, null, 2),
        avatars,
      };
    },
  }),

  /* Owner-only maintenance (v73 addition, owner's request): his
     current counts are test noise, so one action zeroes ALL usage
     data — every copy-history row is deleted and every reply's
     usage counter and last-used stamp are reset — and the
     most-used / least-used / recently-used views and the per-reply
     «اتستخدم N مرة» counters all start fresh. Replies, folders
     and accounts themselves are never touched. Restricted to the
     owner account (the first account), the same convention as
     exportFullBackup. */
  resetUsageStats: defineAction({
    description:
      "Owner-only: resets all usage statistics to zero — clears the entire copy history and sets every reply's usage count to 0 and last-used time to null. Replies and folders are untouched. Cannot be undone.",
    request: z.object({ token: z.string() }),
    response: resetUsageResponse,
    handler: async (ctx, args): Promise<z.infer<typeof resetUsageResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const firstRows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .orderBy(asc(schema.users.id))
        .limit(1);
      const first = firstRows[0];
      if (!first || first.id !== me.id) {
        throw new Error("تصفير الاستخدام متاح لحساب صاحب الموقع بس");
      }
      const historyRows = await db
        .select({ id: schema.copyHistory.id })
        .from(schema.copyHistory);
      const usedRows = await db
        .select({ usageCount: schema.shortcuts.usageCount })
        .from(schema.shortcuts);
      const resetReplies = usedRows.filter((r) => r.usageCount > 0).length;
      await db.delete(schema.copyHistory);
      await db
        .update(schema.shortcuts)
        .set({ usageCount: 0, lastUsedAt: null });
      ctx.invalidateQueries();
      return {
        ok: true,
        clearedHistory: historyRows.length,
        resetReplies,
      };
    },
  }),

  changePassword: defineAction({
    description: "Changes the signed-in user's password after verifying the current one.",
    request: z.object({
      token: z.string(),
      currentPassword: z.string().min(1).max(100),
      newPassword: z.string().min(1).max(100),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (!(await verifyPassword(args.currentPassword, me.passwordHash))) {
        return { ok: false, error: "كلمة المرور الحالية غلط" };
      }
      const passwordHash = await hashPassword(args.newPassword);
      await db
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      return { ok: true, error: null };
    },
  }),

  linkGoogle: defineAction({
    description:
      "Links the signed-in user's Google account email to their IS account, as an additional sign-in identifier shown in their account.",
    request: z.object({
      token: z.string(),
      email: z.string().trim().toLowerCase().min(5).max(120),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(args.email)) {
        return { ok: false, error: "اكتب بريد جوجل صحيح (مثال: name@gmail.com)" };
      }
      const clash = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.googleEmail, args.email))
        .limit(1);
      const other = clash[0];
      if (other && other.id !== me.id) {
        return {
          ok: false,
          error: "حساب جوجل ده مربوط بحساب IS تاني — استخدم حساب جوجل آخر",
        };
      }
      await db
        .update(schema.users)
        .set({ googleEmail: args.email, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  unlinkGoogle: defineAction({
    description: "Removes the Google account link from the signed-in user's IS account.",
    request: z.object({ token: z.string() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await db
        .update(schema.users)
        .set({ googleEmail: null, updatedAt: new Date() })
        .where(eq(schema.users.id, me.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listShortcuts: defineAction({
    description: "Lists the signed-in user's own shortcuts, pinned first then most used. Trashed replies and replies inside trashed folders are excluded — they live in listTrash.",
    request: z.object({ token: z.string() }),
    response: z.object({ shortcuts: z.array(shortcutShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await ensureFolders(ctx, me.id);
      const trashed = await trashedFolderIds(ctx, me.id);
      const rows = await db
        .select({ shortcut: schema.shortcuts, media: schema.replyMedia })
        .from(schema.shortcuts)
        .leftJoin(
          schema.replyMedia,
          eq(schema.replyMedia.shortcutId, schema.shortcuts.id),
        )
        .where(eq(schema.shortcuts.userId, me.id))
        .orderBy(
          desc(schema.shortcuts.pinned),
          asc(schema.shortcuts.sortOrder),
          desc(schema.shortcuts.usageCount),
          asc(schema.shortcuts.id),
        );
      return {
        shortcuts: rows
          .filter((r) => isVisibleShortcut(r.shortcut, trashed))
          .map((r) => toShape(r.shortcut, r.media)),
      };
    },
  }),

  createShortcut: defineAction({
    description: "Creates a new reply in the signed-in user's own library from its title and body.",
    request: z.object({
      token: z.string(),
      title: z.string().trim().min(1).max(200),
      body: z.string().min(1).max(20000),
      category: z.string().trim().min(1).max(60),
      tags: z.string().trim().max(300).optional().default(""),
      /* The reply's own expansion trigger, typed by its owner.
         "" = none; validated + deduped per user in the handler. */
      trigger: z.string().trim().max(100, "الاختصار طويل أوي — خليه 100 حرف أو أقل").optional().default(""),
      /* The external-shortcut note (see the schema): the word the
         user registered for this reply in outside programs, kept
         only so the editor can show it back to him. */
      extShortcut: z.string().trim().max(60).optional().default(""),
      /* Where the reply came from (fixed list, see sourceField). */
      source: sourceField.optional().default(""),
      folderId: z.number().int().positive().nullable().optional(),
    }),
    response: z.object({ shortcut: shortcutShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const trigger = normalizeTrigger(args.trigger);
      await assertTriggerAvailable(ctx, me.id, trigger);
      let category = args.category;
      let folderId: number | null = null;
      /* folderId === null sent explicitly means the top level (no
         folder); only an omitted folderId falls back to resolving
         the folder from the category name, as older callers did. */
      const explicitRoot = args.folderId === null;
      if (args.folderId) {
        const folder = await requireOwnedFolder(ctx, me.id, args.folderId);
        folderId = folder.id;
        category = folder.name;
      } else if (!explicitRoot) {
        const folders = await ensureFolders(ctx, me.id);
        folderId = folders.find((f) => f.name === category)?.id ?? null;
      }
      const siblings = await db
        .select({ sortOrder: schema.shortcuts.sortOrder })
        .from(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            folderId
              ? eq(schema.shortcuts.folderId, folderId)
              : explicitRoot
                ? isNull(schema.shortcuts.folderId)
                : eq(schema.shortcuts.category, category),
          ),
        );
      const sortOrder =
        siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
      const result = await db
        .insert(schema.shortcuts)
        .values({
          userId: me.id,
          title: args.title,
          body: args.body,
          category,
          tags: args.tags,
          trigger,
          extShortcut: args.extShortcut,
          source: args.source,
          folderId,
          sortOrder,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("createShortcut: insert returned no rows");
      ctx.invalidateQueries();
      return { shortcut: toShape(row) };
    },
  }),

  updateShortcut: defineAction({
    description: "Updates one of the signed-in user's own replies (title, body, folder, tags, its external-shortcut note and its source).",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(200),
      body: z.string().min(1).max(20000),
      category: z.string().trim().min(1).max(60),
      tags: z.string().trim().max(300).optional().default(""),
      trigger: z.string().trim().max(100, "الاختصار طويل أوي — خليه 100 حرف أو أقل").optional().default(""),
      extShortcut: z.string().trim().max(60).optional().default(""),
      source: sourceField.optional().default(""),
      /* The editor's folder picker: when sent, the reply is filed
         in this folder (null = the top level) and its category
         follows the folder's name, exactly like a drag & drop move.
         Omitted = the folder stays untouched (older callers). */
      folderId: z.number().int().positive().nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const current = await requireOwnedShortcut(ctx, me.id, args.id);
      const trigger = normalizeTrigger(args.trigger);
      await assertTriggerAvailable(ctx, me.id, trigger, args.id);
      const patch: {
        title: string;
        body: string;
        category: string;
        tags: string;
        trigger: string;
        extShortcut: string;
        source: string;
        folderId?: number | null;
        sortOrder?: number;
        updatedAt: Date;
      } = {
        title: args.title,
        body: args.body,
        category: args.category,
        tags: args.tags,
        trigger,
        extShortcut: args.extShortcut,
        source: args.source,
        updatedAt: new Date(),
      };
      if (args.folderId !== undefined) {
        let category = "عام";
        if (args.folderId) {
          const folder = await requireOwnedFolder(ctx, me.id, args.folderId);
          category = folder.name;
        }
        patch.category = category;
        patch.folderId = args.folderId;
        /* A folder change lands the reply at the end of its new
           home — the same landing moveShortcuts gives a batch. */
        if (args.folderId !== (current.folderId ?? null)) {
          const siblings = await db
            .select({ sortOrder: schema.shortcuts.sortOrder })
            .from(schema.shortcuts)
            .where(
              and(
                eq(schema.shortcuts.userId, me.id),
                args.folderId
                  ? eq(schema.shortcuts.folderId, args.folderId)
                  : isNull(schema.shortcuts.folderId),
              ),
            );
          patch.sortOrder =
            siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
        }
      }
      await db
        .update(schema.shortcuts)
        .set(patch)
        .where(eq(schema.shortcuts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteShortcut: defineAction({
    description: "Moves one of the signed-in user's own replies to the trash (soft delete — restorable from the trash view; permanent deletion is deleteShortcutForever).",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.id);
      await db
        .update(schema.shortcuts)
        .set({ deletedAt: new Date() })
        .where(eq(schema.shortcuts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  toggleFavorite: defineAction({
    description: "Marks or unmarks one of the signed-in user's own replies as a favorite — separate from pinning: pinned stays on top, favorite collects the chosen replies in the favorites view.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      favorite: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.id);
      await db
        .update(schema.shortcuts)
        .set({ favorite: args.favorite, updatedAt: new Date() })
        .where(eq(schema.shortcuts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  togglePin: defineAction({
    description: "Pins or unpins one of the signed-in user's own shortcuts.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      pinned: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.id);
      await db
        .update(schema.shortcuts)
        .set({ pinned: args.pinned, updatedAt: new Date() })
        .where(eq(schema.shortcuts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  recordUse: defineAction({
    description: "Increments the usage counter of one of the signed-in user's own shortcuts and stamps its last-used time for the recently-used history.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const row = await requireOwnedShortcut(ctx, me.id, args.id);
      await db
        .update(schema.shortcuts)
        .set({ usageCount: row.usageCount + 1, lastUsedAt: new Date() })
        .where(eq(schema.shortcuts.id, args.id));
      await logCopy(ctx, me.id, row);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  listCopyHistory: defineAction({
    description:
      "Lists the signed-in user's copy history — every successful copy or expansion of one of their replies, newest first, with the reply it came from when it still exists.",
    request: z.object({ token: z.string() }),
    response: z.object({
      entries: z.array(
        z.object({
          id: z.number(),
          shortcutId: z.number().nullable(),
          title: z.string(),
          copiedAt: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const rows = await db
        .select()
        .from(schema.copyHistory)
        .where(eq(schema.copyHistory.userId, me.id))
        .orderBy(desc(schema.copyHistory.copiedAt), desc(schema.copyHistory.id))
        .limit(100);
      const mine = await db
        .select({ id: schema.shortcuts.id })
        .from(schema.shortcuts)
        .where(eq(schema.shortcuts.userId, me.id));
      const alive = new Set(mine.map((r) => r.id));
      return {
        entries: rows.map((r) => ({
          id: r.id,
          shortcutId:
            r.shortcutId !== null && alive.has(r.shortcutId) ? r.shortcutId : null,
          title: r.title,
          copiedAt: r.copiedAt.toISOString(),
        })),
      };
    },
  }),

  clearCopyHistory: defineAction({
    description: "Clears the signed-in user's whole copy history.",
    request: z.object({ token: z.string() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await db
        .delete(schema.copyHistory)
        .where(eq(schema.copyHistory.userId, me.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  duplicateShortcut: defineAction({
    description: "Duplicates one of the signed-in user's own replies, title suffixed with (نسخة).",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: z.object({ shortcut: shortcutShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const src = await requireOwnedShortcut(ctx, me.id, args.id);
      const result = await db
        .insert(schema.shortcuts)
        .values({
          userId: me.id,
          title: `${src.title} (نسخة)`,
          body: src.body,
          category: src.category,
          tags: src.tags ?? "",
          /* A copy never inherits the trigger: the word stays with
             the original reply, and copying it would collide with
             the per-user uniqueness rule. The owner can set a new
             trigger on the copy in the editor. */
          trigger: "",
          extShortcut: src.extShortcut ?? "",
          source: src.source ?? "",
          favorite: src.favorite ?? false,
          folderId: src.folderId ?? null,
        })
        .returning();
      const row = result[0];
      if (!row) throw new Error("duplicateShortcut: insert returned no rows");
      /* The copy shares the original's media: same Blob object
         (same pathname + URL), new row. No re-upload — and the
         refcount guard in the delete paths keeps the object alive
         while either copy still points at it. */
      const srcMedia = await db
        .select()
        .from(schema.replyMedia)
        .where(eq(schema.replyMedia.shortcutId, src.id))
        .limit(1);
      const media = srcMedia[0] ?? null;
      if (media) {
        await db.insert(schema.replyMedia).values({
          shortcutId: row.id,
          userId: me.id,
          kind: media.kind,
          blobUrl: media.blobUrl,
          blobPathname: media.blobPathname,
          contentType: media.contentType,
          byteSize: media.byteSize,
          width: media.width ?? null,
          height: media.height ?? null,
          durationMs: media.durationMs ?? null,
        });
      }
      ctx.invalidateQueries();
      return { shortcut: toShape(row, media) };
    },
  }),

  importShortcuts: defineAction({
    description:
      "Imports replies into the signed-in user's own library. Merge mode (default) skips items whose title and body both match a reply that already exists; replace mode — only ever sent after an explicit in-site confirmation with a preview — deletes the user's current replies first, then imports.",
    request: z.object({
      token: z.string(),
      items: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(200),
            body: z.string().min(1).max(20000),
            category: z.string().trim().min(1).max(60).default("عام"),
            tags: z.string().trim().max(300).optional().default(""),
            trigger: z.string().trim().max(100, "الاختصار طويل أوي — خليه 100 حرف أو أقل").optional().default(""),
            extShortcut: z.string().trim().max(60).optional().default(""),
            source: sourceField.optional().default(""),
          }),
        )
        .max(2000),
      mode: z.enum(["merge", "replace"]).optional().default("merge"),
    }),
    response: z.object({ imported: z.number(), skipped: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (args.mode === "replace") {
        await db
          .delete(schema.shortcuts)
          .where(eq(schema.shortcuts.userId, me.id));
      }
      const existing = await db
        .select({
          title: schema.shortcuts.title,
          body: schema.shortcuts.body,
        })
        .from(schema.shortcuts)
        .where(eq(schema.shortcuts.userId, me.id));
      /* A reply counts as a duplicate when a row with the same title
         AND the same body already exists. The duplicate check uses
         title+body only — a trigger word in the file is not part of
         the check; triggers are read and restored separately below. */
      const keyOf = (title: string, body: string) =>
        title.trim().toLowerCase() + "\n" + body.trim();
      const seen = new Set(existing.map((r) => keyOf(r.title, r.body)));
      /* Triggers already in this library (live rows only) plus the
         ones this import has already taken, so an imported trigger
         can never collide with another of the user's replies.
         Keyed by the trimmed lowercased text — the comparison is
         case-insensitive, while the stored trigger keeps the exact
         text from the file. */
      const takenTriggers = new Set<string>();
      const liveTriggers = await db
        .select({ trigger: schema.shortcuts.trigger })
        .from(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            isNull(schema.shortcuts.deletedAt),
          ),
        );
      for (const r of liveTriggers)
        if (r.trigger) takenTriggers.add(r.trigger.trim().toLowerCase());
      let imported = 0;
      let skipped = 0;
      for (const item of args.items) {
        const key = keyOf(item.title, item.body);
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        /* An empty or already-taken trigger never fails the whole
           import: that reply simply lands trigger-less, and its
           owner can set a trigger in the editor afterwards. Any
           other text is kept exactly as written in the file. */
        let trigger = "";
        const t = normalizeTrigger(item.trigger);
        if (t && !takenTriggers.has(t.toLowerCase())) {
          trigger = t;
          takenTriggers.add(t.toLowerCase());
        }
        await db.insert(schema.shortcuts).values({
          userId: me.id,
          title: item.title,
          body: item.body,
          category: item.category,
          tags: item.tags,
          trigger,
          extShortcut: item.extShortcut,
          source: item.source,
        });
        imported += 1;
      }
      ctx.invalidateQueries();
      return { imported, skipped };
    },
  }),

  loadStarterPack: defineAction({
    description:
      "Loads the ready-made Elkheta reply pack into the signed-in user's library when it is empty.",
    request: z.object({ token: z.string() }),
    response: z.object({ seeded: z.number() }),
    async handler(ctx, args) {
      const me = await requireUser(ctx, args.token);
      const seeded = await seedForUser(ctx, me.id);
      ctx.invalidateQueries();
      return { seeded };
    },
  }),

  /* Starter library — the set of replies the owner chose (in the
     Shortcuts section) for every new account to start with. The
     content is his choice only: these actions never invent a
     reply. getStarterLibrary answers for anyone (non-owners get
     isOwner false and an empty list, so the picker never renders
     for them); setStarterLibrary is owner-only and validates every
     id against the owner's own live library. */
  getStarterLibrary: defineAction({
    description:
      "Reads the owner-chosen starter library: whether the caller is the owner, and the chosen replies in the owner's order. Non-owners get isOwner false and an empty list.",
    request: z.object({ token: z.string() }),
    response: z.object({
      isOwner: z.boolean(),
      chosen: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
          category: z.string(),
        }),
      ),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const ownerId = await getOwnerId(ctx);
      if (!ownerId || ownerId !== me.id) {
        return { isOwner: false, chosen: [] };
      }
      const ids = await readStarterLibraryIds(ctx);
      if (ids.length === 0) return { isOwner: true, chosen: [] };
      const rows = await db
        .select()
        .from(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            inArray(schema.shortcuts.id, ids),
            isNull(schema.shortcuts.deletedAt),
          ),
        );
      const byId = new Map(rows.map((r) => [r.id, r]));
      return {
        isOwner: true,
        chosen: ids
          .filter((id) => byId.has(id))
          .map((id) => {
            const r = byId.get(id)!;
            return { id: r.id, title: r.title, category: r.category };
          }),
      };
    },
  }),

  setStarterLibrary: defineAction({
    description:
      "Owner-only: replaces the starter library with the given replies from the owner's own library (empty list clears it). New accounts then start with copies of exactly these replies; existing accounts are never touched.",
    request: z.object({
      token: z.string(),
      shortcutIds: z.array(z.number().int().positive()).max(100),
    }),
    response: z.object({ saved: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwner(ctx, me);
      const ids = [...new Set(args.shortcutIds)];
      if (ids.length > 0) {
        const rows = await db
          .select({ id: schema.shortcuts.id })
          .from(schema.shortcuts)
          .where(
            and(
              eq(schema.shortcuts.userId, me.id),
              inArray(schema.shortcuts.id, ids),
              isNull(schema.shortcuts.deletedAt),
            ),
          );
        const ok = new Set(rows.map((r) => r.id));
        if (ids.some((id) => !ok.has(id))) {
          throw new Error(
            "فيه ردود من اللي اخترتها مش في مكتبتك — اختار من ردودك بس",
          );
        }
      }
      const value = JSON.stringify(ids);
      /* Delete + insert instead of an upsert: works identically on
         real Postgres and on the pg-mem test harness. */
      await db
        .delete(schema.siteConfig)
        .where(eq(schema.siteConfig.key, STARTER_LIBRARY_KEY));
      await db
        .insert(schema.siteConfig)
        .values({ key: STARTER_LIBRARY_KEY, value });
      ctx.invalidateQueries();
      return { saved: ids.length };
    },
  }),

  importContentPackForOwner: defineAction({
    description:
      "One-time content import requested by the owner: inserts any official reply-pack items that are still missing from the first (owner) account's library, matched by title and body. Insert-only and idempotent — existing rows, edits and usage counts are never touched, and running it again inserts nothing.",
    request: z.object({}),
    response: z.object({ inserted: z.number(), ownerFound: z.boolean() }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const firstRows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .orderBy(asc(schema.users.id))
        .limit(1);
      const first = firstRows[0];
      if (!first) return { inserted: 0, ownerFound: false };
      const mine = await db
        .select({
          title: schema.shortcuts.title,
          body: schema.shortcuts.body,
        })
        .from(schema.shortcuts)
        .where(eq(schema.shortcuts.userId, first.id));
      const keyOf = (title: string, body: string) =>
        title.trim().toLowerCase() + "\n" + body.trim();
      const have = new Set(mine.map((r) => keyOf(r.title, r.body)));
      let inserted = 0;
      for (const item of SEED) {
        if (have.has(keyOf(item.title, item.body))) continue;
        await db.insert(schema.shortcuts).values({
          userId: first.id,
          title: item.title,
          body: item.body,
          category: item.category,
          pinned: item.pinned ?? false,
        });
        inserted += 1;
      }
      if (inserted > 0) ctx.invalidateQueries();
      return { inserted, ownerFound: true };
    },
  }),

  /* ================= hierarchical folders & drag-and-drop ================= */

  listFolders: defineAction({
    description:
      "Lists the signed-in user's folder tree (nested via parentId, in manual sort order), creating top-level folders for any existing shortcut categories on first load.",
    request: z.object({ token: z.string() }),
    response: z.object({ folders: z.array(folderShape) }),
    async handler(ctx, args) {
      const me = await requireUser(ctx, args.token);
      const folders = await ensureFolders(ctx, me.id);
      return {
        folders: folders.filter((f) => !f.deletedAt).map(toFolderShape),
      };
    },
  }),

  createFolder: defineAction({
    description:
      "Creates a folder in the signed-in user's tree, optionally nested inside a parent folder, with an optional one-line description, an optional chosen icon, and optionally moving a batch of the user's existing replies straight into the new folder.",
    request: z.object({
      token: z.string(),
      name: z.string().trim().min(1).max(60),
      parentId: z.number().int().positive().nullable().optional(),
      description: z.string().trim().max(300).nullable().optional(),
      icon: z.string().trim().max(40).nullable().optional(),
      iconColor: z.string().trim().max(20).nullable().optional(),
      shortcutIds: z.array(z.number().int().positive()).max(500).optional(),
    }),
    response: z.object({ folder: folderShape, moved: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const parentId = args.parentId ?? null;
      if (parentId) await requireOwnedFolder(ctx, me.id, parentId);
      const siblings = await db
        .select()
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, me.id),
            parentId
              ? eq(schema.folders.parentId, parentId)
              : isNull(schema.folders.parentId),
          ),
        );
      const clash = siblings.some(
        (f) => f.name.trim().toLowerCase() === args.name.toLowerCase(),
      );
      if (clash) throw new Error("فيه مجلد بنفس الاسم في المستوى ده");
      const sortOrder =
        siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
      const inserted = await db
        .insert(schema.folders)
        .values({
          userId: me.id,
          name: args.name,
          icon: cleanFolderIcon(args.icon),
          iconColor: cleanFolderIconColor(args.iconColor),
          parentId,
          description: args.description?.trim() ? args.description.trim() : null,
          sortOrder,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("createFolder: insert returned no rows");
      /* Replies the user picked in the create sheet move into the new
         folder in the same call, appended after anything already
         there (nothing — it is new) in the order they were picked.
         Unowned ids are skipped silently, exactly like moveShortcuts. */
      let moved = 0;
      for (const id of args.shortcutIds ?? []) {
        const owned = await db
          .select({ id: schema.shortcuts.id })
          .from(schema.shortcuts)
          .where(
            and(
              eq(schema.shortcuts.id, id),
              eq(schema.shortcuts.userId, me.id),
            ),
          )
          .limit(1);
        if (!owned[0]) continue;
        await db
          .update(schema.shortcuts)
          .set({
            folderId: row.id,
            category: row.name,
            sortOrder: moved,
            updatedAt: new Date(),
          })
          .where(eq(schema.shortcuts.id, id));
        moved += 1;
      }
      ctx.invalidateQueries();
      return { folder: toFolderShape(row), moved };
    },
  }),

  renameFolder: defineAction({
    description:
      "Renames one of the signed-in user's folders; shortcuts inside keep working and their category label follows the new name. When a description is sent it replaces the folder's description (empty clears it); when omitted the description is left as is. When an icon key is sent it replaces the folder's icon (null returns it to automatic); when omitted the icon is left as is.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(300).nullable().optional(),
      icon: z.string().trim().max(40).nullable().optional(),
      iconColor: z.string().trim().max(20).nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const folder = await requireOwnedFolder(ctx, me.id, args.id);
      const siblings = await db
        .select()
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, me.id),
            folder.parentId
              ? eq(schema.folders.parentId, folder.parentId)
              : isNull(schema.folders.parentId),
          ),
        );
      const clash = siblings.some(
        (f) =>
          f.id !== args.id &&
          f.name.trim().toLowerCase() === args.name.toLowerCase(),
      );
      if (clash) throw new Error("فيه مجلد بنفس الاسم في المستوى ده");
      await db
        .update(schema.folders)
        .set({
          name: args.name,
          ...(args.description !== undefined
            ? {
                description: args.description?.trim()
                  ? args.description.trim()
                  : null,
              }
            : {}),
          ...(args.icon !== undefined
            ? { icon: cleanFolderIcon(args.icon) }
            : {}),
          ...(args.iconColor !== undefined
            ? { iconColor: cleanFolderIconColor(args.iconColor) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.folders.id, args.id));
      await db
        .update(schema.shortcuts)
        .set({ category: args.name })
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            eq(schema.shortcuts.folderId, args.id),
          ),
        );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  toggleFolderPin: defineAction({
    description:
      "Pins or unpins one of the signed-in user's folders; pinned folders sort first among their siblings in the tree.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      pinned: z.boolean(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedFolder(ctx, me.id, args.id);
      await db
        .update(schema.folders)
        .set({ pinned: args.pinned, updatedAt: new Date() })
        .where(eq(schema.folders.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  setFolderSource: defineAction({
    description:
      "Sets a folder's source (Chatwoot / Text Blaze / Google Sheets / Google Docs, or empty for none). A non-empty source moves the folder — with everything inside it — under that source's main folder in the same call; the main folder (top level, named after the source) is created on this first use if it does not exist yet, or an existing top-level folder already named after the source is adopted as it. Empty source only clears the label and never moves the folder.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      source: sourceField,
    }),
    response: z.object({
      ok: z.literal(true),
      mainFolderId: z.number().nullable(),
      moved: z.boolean(),
    }),
    handler: async (
      ctx,
      args,
    ): Promise<{
      ok: true;
      mainFolderId: number | null;
      moved: boolean;
    }> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const folder = await requireOwnedFolder(ctx, me.id, args.id);
      if (folder.deletedAt) throw new Error("المجلد ده في سلة المهملات");
      const now = new Date();
      /* «مش محدد»: clear the label only — the folder stays exactly
         where it is. A main folder that loses its source stops
         being a main folder. */
      if (args.source === "") {
        await db
          .update(schema.folders)
          .set({ source: "", isSourceMain: false, updatedAt: now })
          .where(eq(schema.folders.id, args.id));
        ctx.invalidateQueries();
        return { ok: true, mainFolderId: null, moved: false };
      }
      const source = args.source;
      /* Already this source's main folder: nothing to do. */
      if (folder.isSourceMain && folder.source === source) {
        return { ok: true, mainFolderId: folder.id, moved: false };
      }
      const mine = await db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.userId, me.id));
      const alive = mine.filter((f) => !f.deletedAt);
      /* Find the source's main folder: the flagged one first; a
         top-level folder already named after the source is adopted
         (flagged + labelled) instead of creating a namesake. */
      let main =
        alive.find((f) => f.isSourceMain && f.source === source) ?? null;
      if (!main) {
        const namesake = alive.find(
          (f) => f.parentId === null && f.name === source,
        );
        if (namesake) {
          await db
            .update(schema.folders)
            .set({ source, isSourceMain: true, updatedAt: now })
            .where(eq(schema.folders.id, namesake.id));
          main = { ...namesake, source, isSourceMain: true };
        }
      }
      if (!main) {
        const topSort =
          alive
            .filter((f) => f.parentId === null)
            .reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
        const inserted = await db
          .insert(schema.folders)
          .values({
            userId: me.id,
            name: source,
            source,
            isSourceMain: true,
            parentId: null,
            sortOrder: topSort,
          })
          .returning();
        const row = inserted[0];
        if (!row) throw new Error("setFolderSource: insert returned no rows");
        main = row;
      }
      /* The folder being labelled IS the main folder (just adopted):
         it is already home — no move. */
      if (main.id === folder.id) {
        ctx.invalidateQueries();
        return { ok: true, mainFolderId: main.id, moved: false };
      }
      /* Never move a folder into its own subtree. */
      if (await isSelfOrDescendant(ctx, me.id, folder.id, main.id)) {
        throw new Error(
          "المجلد الرئيسي للمصدر ده جوه المجلد نفسه — انقل المجلد الرئيسي لمكان تاني الأول",
        );
      }
      const childSort =
        alive
          .filter((f) => f.parentId === main.id)
          .reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
      const alreadyThere =
        folder.parentId === main.id && folder.source === source;
      await db
        .update(schema.folders)
        .set({
          source,
          isSourceMain: false,
          parentId: main.id,
          ...(alreadyThere ? {} : { sortOrder: childSort }),
          updatedAt: now,
        })
        .where(eq(schema.folders.id, args.id));
      ctx.invalidateQueries();
      return { ok: true, mainFolderId: main.id, moved: !alreadyThere };
    },
  }),

  deleteFolder: defineAction({
    description:
      "Moves one of the signed-in user's folders to the trash (soft delete): the folder, its subfolders and its replies are hidden together and come back exactly as they were on restore. Nothing is destroyed until the trash is emptied or the folder is deleted forever from the trash view.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedFolder(ctx, me.id, args.id);
      await db
        .update(schema.folders)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.folders.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  moveFolder: defineAction({
    description:
      "Moves a folder to a new parent (null = top level) and/or a new position among its siblings. Rejects moving a folder into itself or one of its own descendants.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      newParentId: z.number().int().positive().nullable(),
      orderedSiblingIds: z.array(z.number().int().positive()).max(500),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedFolder(ctx, me.id, args.id);
      if (args.newParentId) {
        await requireOwnedFolder(ctx, me.id, args.newParentId);
        if (
          await isSelfOrDescendant(ctx, me.id, args.id, args.newParentId)
        ) {
          return {
            ok: false,
            error: "مينفعش تنقل مجلد جوه نفسه أو جوه مجلد تابع ليه",
          };
        }
      }
      await db
        .update(schema.folders)
        .set({ parentId: args.newParentId, updatedAt: new Date() })
        .where(eq(schema.folders.id, args.id));
      for (let i = 0; i < args.orderedSiblingIds.length; i++) {
        const sid = args.orderedSiblingIds[i];
        if (sid === undefined) continue;
        await db
          .update(schema.folders)
          .set({ sortOrder: i })
          .where(
            and(
              eq(schema.folders.id, sid),
              eq(schema.folders.userId, me.id),
            ),
          );
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

  moveShortcut: defineAction({
    description:
      "Moves one shortcut to a target folder (null = unfiled top level) at the given sibling order; the ordered id list fixes the target folder's manual order after the move.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      targetFolderId: z.number().int().positive().nullable(),
      orderedIds: z.array(z.number().int().positive()).max(2000),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.id);
      let category = "عام";
      if (args.targetFolderId) {
        const folder = await requireOwnedFolder(ctx, me.id, args.targetFolderId);
        category = folder.name;
      }
      await db
        .update(schema.shortcuts)
        .set({ folderId: args.targetFolderId, category, updatedAt: new Date() })
        .where(eq(schema.shortcuts.id, args.id));
      for (let i = 0; i < args.orderedIds.length; i++) {
        const sid = args.orderedIds[i];
        if (sid === undefined) continue;
        await db
          .update(schema.shortcuts)
          .set({ sortOrder: i })
          .where(
            and(
              eq(schema.shortcuts.id, sid),
              eq(schema.shortcuts.userId, me.id),
            ),
          );
      }
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  moveShortcuts: defineAction({
    description:
      "Moves a batch of the signed-in user's shortcuts into one target folder at once (multi-select drag & drop / move-to menu).",
    request: z.object({
      token: z.string(),
      ids: z.array(z.number().int().positive()).min(1).max(500),
      targetFolderId: z.number().int().positive().nullable(),
    }),
    response: z.object({ moved: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      let category = "عام";
      if (args.targetFolderId) {
        const folder = await requireOwnedFolder(ctx, me.id, args.targetFolderId);
        category = folder.name;
      }
      const existing = await db
        .select({ sortOrder: schema.shortcuts.sortOrder })
        .from(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            args.targetFolderId
              ? eq(schema.shortcuts.folderId, args.targetFolderId)
              : isNull(schema.shortcuts.folderId),
          ),
        );
      let next = existing.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
      let moved = 0;
      for (const id of args.ids) {
        const owned = await db
          .select({ id: schema.shortcuts.id })
          .from(schema.shortcuts)
          .where(
            and(
              eq(schema.shortcuts.id, id),
              eq(schema.shortcuts.userId, me.id),
            ),
          )
          .limit(1);
        if (!owned[0]) continue;
        await db
          .update(schema.shortcuts)
          .set({
            folderId: args.targetFolderId,
            category,
            sortOrder: next++,
            updatedAt: new Date(),
          })
          .where(eq(schema.shortcuts.id, id));
        moved += 1;
      }
      ctx.invalidateQueries();
      return { moved };
    },
  }),

  /* ================= trash =================
     Soft-deleted replies and folders land here. Restoring a reply
     clears its stamp; restoring a folder clears the folder's stamp
     and its whole subtree becomes visible again (children were
     never touched). Permanent deletion is explicit and separate. */

  listTrash: defineAction({
    description: "Lists the signed-in user's trash: soft-deleted replies (deleted directly, not via a folder) and soft-deleted folders, newest deletion first.",
    request: z.object({ token: z.string() }),
    response: z.object({
      shortcuts: z.array(shortcutShape),
      folders: z.array(folderShape),
    }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const trashedFolders = await trashedFolderIds(ctx, me.id);
      const sRows = await db
        .select({ shortcut: schema.shortcuts, media: schema.replyMedia })
        .from(schema.shortcuts)
        .leftJoin(
          schema.replyMedia,
          eq(schema.replyMedia.shortcutId, schema.shortcuts.id),
        )
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            isNotNull(schema.shortcuts.deletedAt),
          ),
        )
        .orderBy(desc(schema.shortcuts.deletedAt), desc(schema.shortcuts.id));
      const fRows = await db
        .select()
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, me.id),
            isNotNull(schema.folders.deletedAt),
          ),
        )
        .orderBy(desc(schema.folders.deletedAt), desc(schema.folders.id));
      /* A reply trashed directly whose folder was later trashed too
         rides with the folder — restoring the folder revives it —
         so it is not listed separately. */
      return {
        shortcuts: sRows
          .filter(
            (r) =>
              r.shortcut.folderId === null ||
              r.shortcut.folderId === undefined ||
              !trashedFolders.has(r.shortcut.folderId),
          )
          .map((r) => toShape(r.shortcut, r.media)),
        folders: fRows.map(toFolderShape),
      };
    },
  }),

  restoreShortcut: defineAction({
    description: "Restores one trashed reply of the signed-in user back into its folder.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedShortcut(ctx, me.id, args.id);
      await db
        .update(schema.shortcuts)
        .set({ deletedAt: null })
        .where(eq(schema.shortcuts.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteShortcutForever: defineAction({
    description: "Permanently deletes one trashed reply of the signed-in user. Only works on a reply that is actually in the trash.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const row = await requireOwnedShortcut(ctx, me.id, args.id);
      if (!row.deletedAt) throw new Error("الرد ده مش في سلة المهملات");
      /* Blob first (pathnames are known while the rows exist),
         then the row delete cascades the media row. The object
         itself is dropped only when no surviving reply still
         references it (a duplicate shares the object). */
      const pathnames = await mediaPathnamesForShortcuts(ctx, [args.id]);
      await db
        .delete(schema.shortcuts)
        .where(eq(schema.shortcuts.id, args.id));
      await deleteBlobsIfUnreferenced(ctx, pathnames);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  restoreFolder: defineAction({
    description: "Restores one trashed folder of the signed-in user, with its subfolders and replies exactly as they were.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await requireOwnedFolder(ctx, me.id, args.id);
      await db
        .update(schema.folders)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(schema.folders.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteFolderForever: defineAction({
    description: "Permanently deletes one trashed folder of the signed-in user together with its whole subtree and every reply inside it. Only works on a folder that is actually in the trash.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const me = await requireUser(ctx, args.token);
      const folder = await requireOwnedFolder(ctx, me.id, args.id);
      if (!folder.deletedAt) throw new Error("المجلد ده مش في سلة المهملات");
      await hardDeleteFolderTree(ctx, me.id, args.id);
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  emptyTrash: defineAction({
    description: "Permanently deletes everything in the signed-in user's trash: every trashed reply and every trashed folder with its subtree and contents.",
    request: z.object({ token: z.string() }),
    response: z.object({ ok: z.boolean(), removed: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const trashedFolders = await db
        .select({ id: schema.folders.id })
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, me.id),
            isNotNull(schema.folders.deletedAt),
          ),
        );
      let removed = 0;
      for (const f of trashedFolders) {
        removed += await hardDeleteFolderTree(ctx, me.id, f.id);
      }
      /* Trashed replies NOT inside a trashed folder (those rode
         with the folder tree above, whose media the tree already
         cleaned up): collect their media pathnames first, then
         delete the rows, then drop unreferenced Blob objects. */
      const trashedIds = new Set(trashedFolders.map((f) => f.id));
      const restRows = await db
        .select({ id: schema.shortcuts.id, folderId: schema.shortcuts.folderId })
        .from(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            isNotNull(schema.shortcuts.deletedAt),
          ),
        );
      const restIds = restRows
        .filter(
          (r) =>
            r.folderId === null ||
            r.folderId === undefined ||
            !trashedIds.has(r.folderId),
        )
        .map((r) => r.id);
      const pathnames = await mediaPathnamesForShortcuts(ctx, restIds);
      const rest = await db
        .delete(schema.shortcuts)
        .where(
          and(
            eq(schema.shortcuts.userId, me.id),
            isNotNull(schema.shortcuts.deletedAt),
          ),
        )
        .returning({ id: schema.shortcuts.id });
      await deleteBlobsIfUnreferenced(ctx, pathnames);
      removed += rest.length;
      ctx.invalidateQueries();
      return { ok: true, removed };
    },
  }),

  /* ================= folder duplicate + bulk ================= */

  duplicateFolder: defineAction({
    description: "Duplicates one of the signed-in user's folders with its whole subtree and the replies inside (usage counts restart at zero on the copies). The copy lands beside the original with «(نسخة)» on its name.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: z.object({ folder: folderShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const src = await requireOwnedFolder(ctx, me.id, args.id);
      if (src.deletedAt) throw new Error("المجلد ده في سلة المهملات");
      const allFolders = await db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.userId, me.id));
      const alive = allFolders.filter((f) => !f.deletedAt);
      const childrenOf = new Map<number | null, FolderRow[]>();
      for (const f of alive) {
        const key = f.parentId ?? null;
        const arr = childrenOf.get(key) ?? [];
        arr.push(f);
        childrenOf.set(key, arr);
      }
      /* Breadth-first copy so every parent exists before its children. */
      const idMap = new Map<number, number>();
      const queue: Array<{ src: FolderRow; parentId: number | null; isRoot: boolean }> = [
        { src, parentId: src.parentId ?? null, isRoot: true },
      ];
      let rootCopy: FolderRow | null = null;
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const siblings = await db
          .select({ sortOrder: schema.folders.sortOrder })
          .from(schema.folders)
          .where(
            and(
              eq(schema.folders.userId, me.id),
              item.parentId
                ? eq(schema.folders.parentId, item.parentId)
                : isNull(schema.folders.parentId),
            ),
          );
        const sortOrder =
          siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
        const inserted = await db
          .insert(schema.folders)
          .values({
            userId: me.id,
            name: item.isRoot ? `${item.src.name} (نسخة)` : item.src.name,
            icon: item.src.icon ?? null,
            iconColor: item.src.iconColor ?? null,
            /* A copy keeps the folder's source label but is never
               itself a source's main folder. */
            source: item.src.source ?? "",
            isSourceMain: false,
            parentId: item.parentId,
            pinned: false,
            description: item.src.description ?? null,
            sortOrder,
          })
          .returning();
        const copy = inserted[0];
        if (!copy) throw new Error("duplicateFolder: insert returned no rows");
        idMap.set(item.src.id, copy.id);
        if (item.isRoot) rootCopy = copy;
        const srcReplies = await db
          .select()
          .from(schema.shortcuts)
          .where(
            and(
              eq(schema.shortcuts.userId, me.id),
              eq(schema.shortcuts.folderId, item.src.id),
              isNull(schema.shortcuts.deletedAt),
            ),
          )
          .orderBy(asc(schema.shortcuts.sortOrder), asc(schema.shortcuts.id));
        for (const r of srcReplies) {
          const insertedReply = await db
            .insert(schema.shortcuts)
            .values({
              userId: me.id,
              title: r.title,
              body: r.body,
              category: copy.name,
              tags: r.tags ?? "",
              /* Folder copies never inherit triggers (see
                 duplicateShortcut): each copied reply starts
                 trigger-less so no per-user collision can occur. */
              trigger: "",
              extShortcut: r.extShortcut ?? "",
              source: r.source ?? "",
              folderId: copy.id,
              sortOrder: r.sortOrder,
              pinned: r.pinned,
              favorite: r.favorite ?? false,
            })
            .returning();
          const replyCopy = insertedReply[0];
          if (!replyCopy) continue;
          /* The copy shares the original's media (same Blob
             object, new row) — see duplicateShortcut. */
          const rMedia = await db
            .select()
            .from(schema.replyMedia)
            .where(eq(schema.replyMedia.shortcutId, r.id))
            .limit(1);
          const m = rMedia[0];
          if (m) {
            await db.insert(schema.replyMedia).values({
              shortcutId: replyCopy.id,
              userId: me.id,
              kind: m.kind,
              blobUrl: m.blobUrl,
              blobPathname: m.blobPathname,
              contentType: m.contentType,
              byteSize: m.byteSize,
              width: m.width ?? null,
              height: m.height ?? null,
              durationMs: m.durationMs ?? null,
            });
          }
        }
        for (const child of childrenOf.get(item.src.id) ?? []) {
          queue.push({ src: child, parentId: copy.id, isRoot: false });
        }
      }
      if (!rootCopy) throw new Error("duplicateFolder: nothing copied");
      ctx.invalidateQueries();
      return { folder: toFolderShape(rootCopy) };
    },
  }),

  bulkUpdateShortcuts: defineAction({
    description: "Applies one bulk operation to a batch of the signed-in user's own replies: pin, unpin, favorite, unfavorite, move to trash, or add one tag to all of them. Foreign ids are skipped silently.",
    request: z.object({
      token: z.string(),
      ids: z.array(z.number().int().positive()).min(1).max(500),
      op: z.enum(["pin", "unpin", "favorite", "unfavorite", "trash", "addTag"]),
      tag: z.string().trim().max(60).optional(),
    }),
    response: z.object({ ok: z.boolean(), changed: z.number() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (args.op === "addTag" && !args.tag)
        return { ok: false, changed: 0 };
      let changed = 0;
      for (const id of args.ids) {
        const rows = await db
          .select()
          .from(schema.shortcuts)
          .where(
            and(
              eq(schema.shortcuts.id, id),
              eq(schema.shortcuts.userId, me.id),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (!row) continue;
        if (args.op === "pin")
          await db.update(schema.shortcuts).set({ pinned: true }).where(eq(schema.shortcuts.id, id));
        else if (args.op === "unpin")
          await db.update(schema.shortcuts).set({ pinned: false }).where(eq(schema.shortcuts.id, id));
        else if (args.op === "favorite")
          await db.update(schema.shortcuts).set({ favorite: true }).where(eq(schema.shortcuts.id, id));
        else if (args.op === "unfavorite")
          await db.update(schema.shortcuts).set({ favorite: false }).where(eq(schema.shortcuts.id, id));
        else if (args.op === "trash")
          await db.update(schema.shortcuts).set({ deletedAt: new Date() }).where(eq(schema.shortcuts.id, id));
        else if (args.op === "addTag" && args.tag) {
          const tags = (row.tags ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          if (!tags.includes(args.tag)) {
            tags.push(args.tag);
            await db
              .update(schema.shortcuts)
              .set({ tags: tags.join("، ") })
              .where(eq(schema.shortcuts.id, id));
          }
        }
        changed += 1;
      }
      ctx.invalidateQueries();
      return { ok: true, changed };
    },
  }),

  /* ================= smart folders ================= */

  listSmartFolders: defineAction({
    description: "Lists the signed-in user's smart folders (saved rule sets the client evaluates against the live library).",
    request: z.object({ token: z.string() }),
    response: z.object({ smartFolders: z.array(smartFolderShape) }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const rows = await db
        .select()
        .from(schema.smartFolders)
        .where(eq(schema.smartFolders.userId, me.id))
        .orderBy(asc(schema.smartFolders.sortOrder), asc(schema.smartFolders.id));
      return { smartFolders: rows.map(toSmartShape) };
    },
  }),

  createSmartFolder: defineAction({
    description: "Creates a smart folder for the signed-in user: a named set of rules (any-of tags, optional folder scope, pinned/favorite-only, minimum uses, unused-for-days) evaluated live against the library.",
    request: z.object({
      token: z.string(),
      name: z.string().trim().min(1).max(60),
      icon: z.string().trim().max(40).nullable().optional(),
      iconColor: z.string().trim().max(20).nullable().optional(),
      tags: z.string().trim().max(300).optional().default(""),
      folderId: z.number().int().positive().nullable().optional(),
      pinnedOnly: z.boolean().optional().default(false),
      favoriteOnly: z.boolean().optional().default(false),
      minUses: z.number().int().min(0).max(100000).nullable().optional(),
      unusedDays: z.number().int().min(1).max(3650).nullable().optional(),
    }),
    response: z.object({ smartFolder: smartFolderShape }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      if (args.folderId) await requireOwnedFolder(ctx, me.id, args.folderId);
      const siblings = await db
        .select({ sortOrder: schema.smartFolders.sortOrder })
        .from(schema.smartFolders)
        .where(eq(schema.smartFolders.userId, me.id));
      const sortOrder =
        siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
      const inserted = await db
        .insert(schema.smartFolders)
        .values({
          userId: me.id,
          name: args.name,
          icon: cleanFolderIcon(args.icon),
          iconColor: cleanFolderIconColor(args.iconColor),
          tags: args.tags,
          folderId: args.folderId ?? null,
          pinnedOnly: args.pinnedOnly,
          favoriteOnly: args.favoriteOnly,
          minUses: args.minUses ?? null,
          unusedDays: args.unusedDays ?? null,
          sortOrder,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error("createSmartFolder: insert returned no rows");
      ctx.invalidateQueries();
      return { smartFolder: toSmartShape(row) };
    },
  }),

  updateSmartFolder: defineAction({
    description: "Updates the rules of one of the signed-in user's smart folders.",
    request: z.object({
      token: z.string(),
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(60),
      icon: z.string().trim().max(40).nullable().optional(),
      iconColor: z.string().trim().max(20).nullable().optional(),
      tags: z.string().trim().max(300).optional().default(""),
      folderId: z.number().int().positive().nullable().optional(),
      pinnedOnly: z.boolean().optional().default(false),
      favoriteOnly: z.boolean().optional().default(false),
      minUses: z.number().int().min(0).max(100000).nullable().optional(),
      unusedDays: z.number().int().min(1).max(3650).nullable().optional(),
    }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const rows = await db
        .select()
        .from(schema.smartFolders)
        .where(
          and(
            eq(schema.smartFolders.id, args.id),
            eq(schema.smartFolders.userId, me.id),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new Error("المجلد الذكي ده مش موجود في مكتبتك");
      if (args.folderId) await requireOwnedFolder(ctx, me.id, args.folderId);
      await db
        .update(schema.smartFolders)
        .set({
          name: args.name,
          ...(args.icon !== undefined
            ? { icon: cleanFolderIcon(args.icon) }
            : {}),
          ...(args.iconColor !== undefined
            ? { iconColor: cleanFolderIconColor(args.iconColor) }
            : {}),
          tags: args.tags,
          folderId: args.folderId ?? null,
          pinnedOnly: args.pinnedOnly,
          favoriteOnly: args.favoriteOnly,
          minUses: args.minUses ?? null,
          unusedDays: args.unusedDays ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.smartFolders.id, args.id));
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  deleteSmartFolder: defineAction({
    description: "Deletes one of the signed-in user's smart folders. Only the rule set is deleted — no reply is touched, moved or copied.",
    request: z.object({ token: z.string(), id: z.number().int().positive() }),
    response: okResponse,
    handler: async (ctx, args): Promise<z.infer<typeof okResponse>> => {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      await db
        .delete(schema.smartFolders)
        .where(
          and(
            eq(schema.smartFolders.id, args.id),
            eq(schema.smartFolders.userId, me.id),
          ),
        );
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),

  applyTreeOrder: defineAction({
    description:
      "Applies a complete folder/shortcut placement snapshot for the signed-in user — the persistence engine behind drag & drop reordering, sort-by-name/date, and undo/redo of tree moves. Only rows the user owns are touched, and folder cycles are rejected.",
    request: z.object({
      token: z.string(),
      folders: z
        .array(
          z.object({
            id: z.number().int().positive(),
            parentId: z.number().int().positive().nullable(),
            sortOrder: z.number().int().min(0).max(100000),
          }),
        )
        .max(1000),
      shortcuts: z
        .array(
          z.object({
            id: z.number().int().positive(),
            folderId: z.number().int().positive().nullable(),
            category: z.string().trim().min(1).max(60),
            sortOrder: z.number().int().min(0).max(100000),
          }),
        )
        .max(3000),
    }),
    response: z.object({ ok: z.boolean(), error: z.string().nullable() }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const me = await requireUser(ctx, args.token);
      const myFolders = await db
        .select()
        .from(schema.folders)
        .where(eq(schema.folders.userId, me.id));
      const myFolderIds = new Set(myFolders.map((f) => f.id));
      // Validate: every referenced folder is owned, and no cycles.
      // The cycle check runs against the merged tree (current parents
      // overlaid with the snapshot's), so even a partial snapshot can
      // never close a loop through folders it does not mention.
      const parentOf = new Map<number, number | null>(
        myFolders.map((f) => [f.id, f.parentId ?? null]),
      );
      for (const f of args.folders) {
        if (!myFolderIds.has(f.id)) return { ok: false, error: "مجلد مش موجود" };
        if (f.parentId !== null && !myFolderIds.has(f.parentId))
          return { ok: false, error: "المجلد الأب مش موجود" };
        parentOf.set(f.id, f.parentId);
      }
      for (const f of args.folders) {
        let cur: number | null = f.id;
        const seen = new Set<number>();
        while (cur !== null) {
          if (seen.has(cur))
            return { ok: false, error: "الترتيب ده بيعمل دورة بين المجلدات" };
          seen.add(cur);
          cur = parentOf.get(cur) ?? null;
        }
      }
      for (const f of args.folders) {
        await db
          .update(schema.folders)
          .set({ parentId: f.parentId, sortOrder: f.sortOrder, updatedAt: new Date() })
          .where(
            and(eq(schema.folders.id, f.id), eq(schema.folders.userId, me.id)),
          );
      }
      for (const s of args.shortcuts) {
        if (s.folderId !== null && !myFolderIds.has(s.folderId))
          return { ok: false, error: "مجلد الهدف مش موجود" };
        await db
          .update(schema.shortcuts)
          .set({
            folderId: s.folderId,
            category: s.category,
            sortOrder: s.sortOrder,
          })
          .where(
            and(
              eq(schema.shortcuts.id, s.id),
              eq(schema.shortcuts.userId, me.id),
            ),
          );
      }
      ctx.invalidateQueries();
      return { ok: true, error: null };
    },
  }),

} satisfies ActionsModule;
