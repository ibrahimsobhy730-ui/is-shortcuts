import {
  boolean,
  customType,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* Postgres port of the original SQLite schema (server/src/schema.ts in the
   Muse artifact, migrations 0001–0022 applied). Table and column names are
   IDENTICAL to the SQLite original so the ported server actions — and the
   one raw SQL statement they contain — work unchanged.
   Differences from SQLite, all mechanical:
   - integer autoincrement PK  -> serial
   - integer({ mode: "timestamp_ms" }) -> timestamp (ms precision, JS Date)
   - integer({ mode: "boolean" }) -> boolean
   - avatar blobs (formerly ctx.blobs) live in the avatar_blobs table
     below, keyed the same way (`avatars/<userId>`). */

const ts = (name: string) =>
  timestamp(name, { mode: "date", precision: 3 });

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Nullable since the email-first registration: an account is identified
  // by its email and/or its Egyptian mobile — at least one is always set
  // (enforced in the register action). Legacy accounts carry phone only.
  phone: text("phone").unique(),
  googleEmail: text("google_email"),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  /* Profile picture: the key of the image blob in avatar_blobs
     (avatars/<userId>), or null when the account has no picture and
     the UI falls back to the name's first letter. The bytes live in
     the avatar_blobs table, never in this table, and the key is
     per-account so the picture syncs to every device the user signs
     in on. */
  avatarBlobKey: text("avatar_blob_key"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

/* Copy history: one row per successful copy/expansion of a library
   reply on the site, stamped when it happened.
   The title is snapshotted so the history still reads correctly
   after the reply is renamed; shortcut_id goes null only in the
   snapshot sense — the row itself is kept when a reply is deleted,
   and re-copy simply becomes unavailable for it. Pruned to the
   latest 200 rows per account on every insert. */
export const copyHistory = pgTable("copy_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  shortcutId: integer("shortcut_id"),
  title: text("title").notNull(),
  copiedAt: ts("copied_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  expiresAt: ts("expires_at").notNull(),
});

/* Site-wide configuration flags — currently the one-time
   owner-access-restore marker written by the restoreOwnerAccess
   action so the restore can never run a second time. */
export const siteConfig = pgTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* Hierarchical folders for the file-explorer navigation. A folder
   belongs to one account and may nest inside another folder of the
   same account (parent_id null = top level). sort_order is the
   manual order among siblings; it is what drag & drop persists. */
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /* The folder's chosen icon, as a key from the client's fixed icon
     catalogue (e.g. "wallet", "star"). Null = automatic: the client
     falls back to the icon that matches the folder's name/subject,
     then to the plain folder glyph. Validated against the catalogue
     in the folder actions, so the column never holds junk. */
  icon: text("icon"),
  /* The folder's chosen icon colour: a key from the client's
     colour palette (e.g. "royal", "rose") or a custom hex colour
     ("#rrggbb") picked from the colour picker. Null = automatic:
     the tile colour follows the folder's name (the name-hash hue
     the client has always used). Validated in the folder actions,
     so the column never holds junk. */
  iconColor: text("icon_color"),
  /* The folder's source, picked on the folder itself from the same
     fixed list as the replies' source (Chatwoot / Text Blaze /
     Google Sheets / Google Docs). Empty = no source recorded.
     Setting a source moves the folder under that source's MAIN
     folder (see isSourceMain) in the same call — the move is done
     by the setFolderSource action, never by hand. */
  source: text("source").notNull().default(""),
  /* True only for the one MAIN folder of a source: the top-level
     folder (named after the source) that every folder assigned
     that source is moved under. Created lazily by setFolderSource
     the first time the source is assigned — never before use.
     A duplicate of a main folder is a normal folder (false). */
  isSourceMain: boolean("is_source_main").notNull().default(false),
  parentId: integer("parent_id"),
  /* Pinned folders sort first among their siblings and carry a pin
     marker in the tree, so the folders used every day stay on top. */
  pinned: boolean("pinned").notNull().default(false),
  /* Soft delete: deleting a folder moves it (and, by visibility, its
     whole subtree and replies) to the trash instead of destroying
     it. Null = alive. The row, its children and its replies keep
     their places, so a restore brings everything back exactly as
     it was; permanent deletion happens only from the trash. */
  deletedAt: ts("deleted_at"),
  /* Optional one-line description shown in the folder header of the
     main content area. Null = no description written yet. */
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

/* Smart folders: user-defined live views over the library. A smart
   folder never holds or copies replies — it stores only its rules
   (any-of tags, an optional folder scope, pinned/favorite-only
   flags, a minimum use count, an "unused for N days" window), and
   the client lists whichever replies match right now. Deleting a
   smart folder deletes only the rules, never a reply. */
export const smartFolders = pgTable("smart_folders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /* Same icon catalogue as folders (validated in the actions);
     null = automatic (the sparkles glyph). */
  icon: text("icon"),
  /* Same per-folder icon colour palette as folders; null =
     automatic (the name-hash hue). */
  iconColor: text("icon_color"),
  /* Comma-separated tag list; a reply matches when it carries ANY
     of them. Empty = no tag rule. */
  tags: text("tags").notNull().default(""),
  /* Optional scope: only replies inside this folder (and its
     subfolders) match. Null = the whole library. */
  folderId: integer("folder_id"),
  pinnedOnly: boolean("pinned_only").notNull().default(false),
  favoriteOnly: boolean("favorite_only").notNull().default(false),
  /* Minimum copy count; null = no usage rule. */
  minUses: integer("min_uses"),
  /* "Not used for at least N days" (never used counts); null = off. */
  unusedDays: integer("unused_days"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const shortcuts = pgTable("shortcuts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("عام"),
  /* Free-form keywords (comma-separated as typed) that search matches
     alongside title/body — the reply's tags. */
  tags: text("tags").notNull().default(""),
  /* The reply's own expansion trigger, chosen and typed by its owner
     in the reply editor — free-form text, any language, case or
     characters, stored exactly as typed (see normalizeTrigger in
     lib/actions.ts). Per-user: uniqueness is scoped to (user_id,
     trigger), compared case-insensitively on the trimmed text —
     another account may use the same text. Empty = this reply has
     no trigger. The site's shortcuts section / shortcut bar reads
     only the signed-in user's triggers. The column is TEXT (no
     length limit); the 100-char cap lives in the request schemas.
     Never auto-assigned and
     never copied from extShortcut (that field stays a record-only
     note about outside programs). */
  trigger: text("trigger").notNull().default(""),
  /* The shortcut word the user registered for this reply in programs
     OUTSIDE the site (his own text expander), written by him in the
     reply editor purely so he can see which external shortcut a
     reply belongs to. A record-keeping note only: nothing on the
     site expands, matches or copies by it — the site's own
     functional trigger is the `trigger` field above, while this
     field stays a record-only note about outside programs.
     Empty = not recorded. */
  extShortcut: text("ext_shortcut").notNull().default(""),
  /* Where this reply originally came from, picked by the user in
     the editor from a fixed list (Chatwoot / Text Blaze /
     Google Sheets / Google Docs) so he can remember each reply's
     origin. A record-keeping label only — it changes nothing
     about copying, search or sync. Empty = no source recorded.
     (The "Text Blaze" value is just a source name in this list;
     there is no extension or sidebar item for it.) */
  source: text("source").notNull().default(""),
  folderId: integer("folder_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  pinned: boolean("pinned").notNull().default(false),
  /* Favorite is its own state, separate from pinned: pinned keeps a
     reply at the top of its folder; favorite marks it as one of the
     user's chosen replies (the «المفضلة» view). Migration 0017
     seeded favorite = pinned for existing rows so the favorites
     view kept exactly the replies it already showed. */
  favorite: boolean("favorite").notNull().default(false),
  /* Soft delete: deleting a reply moves it to the trash (this stamp
     set) instead of destroying it; restore clears the stamp.
     Permanent deletion happens only from the trash view. */
  deletedAt: ts("deleted_at"),
  usageCount: integer("usage_count").notNull().default(0),
  /* Stamped by every copy/expansion (recordUse and its key-based
     twin) so the «استُخدمت مؤخراً» history is real usage order,
     never a guess. Null until the reply is used for the first time. */
  lastUsedAt: ts("last_used_at"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

/* Reply media: one image attached to a reply (images only —
   video was cancelled by the owner 2026-11-26; the kind column
   stays, always "image"). The bytes
   live in Vercel Blob (public URLs, see app/api/media/upload);
   this table holds only the reference + display metadata, never
   the bytes. One media per reply (unique shortcut_id); deleting
   the reply deletes its media row (ON DELETE CASCADE) — the Blob
   object itself is deleted by the action handlers with a refcount
   guard, since a duplicated reply shares the same Blob object. */
export const replyMedia = pgTable("reply_media", {
  id: serial("id").primaryKey(),
  shortcutId: integer("shortcut_id")
    .notNull()
    .references(() => shortcuts.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});

/* Profile-picture bytes. In the Muse artifact these lived in the
   platform blob store (ctx.blobs) under the key `avatars/<userId>`;
   here they live in Postgres so the free Neon tier needs no extra
   storage service. One row per account, at most ~2 MB (the client
   downscales to 512px before upload). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const avatarBlobs = pgTable("avatar_blobs", {
  key: text("key").primaryKey(),
  data: bytea("data").notNull(),
  contentType: text("content_type").notNull(),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
});
