import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import { getDb } from "./db.ts";
import * as schema from "./schema.ts";

export { z };

/* Minimal re-implementation of the @hatch/space-sdk server surface the
   ported actions use — nothing else from the SDK is needed here:
   - defineAction: keeps the { description, request, response, handler }
     shape so server/src/actions.ts ports with only its import line changed.
   - Ctx: the per-request context. `db()` returns the drizzle Postgres
     instance (the `<typeof schema>` generic is accepted and ignored —
     there is exactly one schema). `blobs` is the avatar store backed
     by the avatar_blobs table (same keys as before: `avatars/<userId>`).
     `invalidateQueries()` only sets a flag: the /api/actions route
     reads it and tells the client to refetch (the SDK did the same
     over its own bridge). `invalidateKeys(...keys)` records instead
     the exact query keys to refetch — see Ctx below. */

export interface ActionDefinition<
  Req extends z.ZodTypeAny = z.ZodTypeAny,
  Res extends z.ZodTypeAny = z.ZodTypeAny,
> {
  description: string;
  request: Req;
  response: Res;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
}

export function defineAction<
  Req extends z.ZodTypeAny,
  Res extends z.ZodTypeAny,
>(def: ActionDefinition<Req, Res>): ActionDefinition<Req, Res> {
  return def;
}

export type ActionsModule = Record<
  string,
  ActionDefinition<z.ZodTypeAny, z.ZodTypeAny>
>;

export interface BlobStore {
  getUrl(key: string): Promise<string>;
  /** Content type of a stored blob, or null when the key is absent.
    Needed by the full-backup export (it reports each avatar's type
    so the client can embed the bytes). */
  head(key: string): Promise<{ contentType: string } | null>;
  put(
    key: string,
    bytes: Buffer,
    opts: { contentType: string },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Ctx {
  db<S extends Record<string, unknown>>(): NodePgDatabase<S>;
  blobs: BlobStore;
  invalidateQueries(): void;
  /** Targeted invalidation (خفيف 2026-11-26): records the query-key
      prefixes the client should refetch (e.g. "shortcuts"), so a
      mutation does not force a refetch of me + folders + smart
      folders too. The /api/actions route returns these keys and
      the client invalidates exactly them. Calling
      invalidateQueries() means "everything" (invalidatedKeys
      stays null) — kept for auth/account/import actions whose
      affected surface is broad. */
  invalidateKeys(...keys: string[]): void;
  /** True when any handler in this request called invalidateQueries(). */
  readonly invalidated: boolean;
  /** Key prefixes to refetch, or null when the whole cache must go. */
  readonly invalidatedKeys: string[] | null;
}

function createBlobStore(db: NodePgDatabase<typeof schema>): BlobStore {
  return {
    async getUrl(key: string): Promise<string> {
      // Keys are always `avatars/<userId>`; the avatar route serves them.
      const m = /^avatars\/(\d+)$/.exec(key);
      if (!m) throw new Error(`unknown blob key: ${key}`);
      const rows = await db
        .select({ key: schema.avatarBlobs.key })
        .from(schema.avatarBlobs)
        .where(eq(schema.avatarBlobs.key, key))
        .limit(1);
      if (rows.length === 0) throw new Error(`blob missing: ${key}`);
      return `/api/avatar/${m[1]}`;
    },
    async head(key: string): Promise<{ contentType: string } | null> {
      const rows = await db
        .select({ contentType: schema.avatarBlobs.contentType })
        .from(schema.avatarBlobs)
        .where(eq(schema.avatarBlobs.key, key))
        .limit(1);
      if (rows.length === 0) return null;
      const row = rows[0];
      if (!row) return null;
      return { contentType: row.contentType };
    },
    async put(
      key: string,
      bytes: Buffer,
      opts: { contentType: string },
    ): Promise<void> {
      await db
        .insert(schema.avatarBlobs)
        .values({
          key,
          data: bytes,
          contentType: opts.contentType,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.avatarBlobs.key,
          set: { data: bytes, contentType: opts.contentType, updatedAt: new Date() },
        });
    },
    async delete(key: string): Promise<void> {
      await db
        .delete(schema.avatarBlobs)
        .where(eq(schema.avatarBlobs.key, key));
    },
  };
}

export function createCtx(): Ctx {
  const db = getDb();
  let invalidated = false;
  let invalidatedKeys: string[] | null = null;
  return {
    db<S extends Record<string, unknown>>(): NodePgDatabase<S> {
      return db as unknown as NodePgDatabase<S>;
    },
    blobs: createBlobStore(db),
    invalidateQueries(): void {
      invalidated = true;
    },
    invalidateKeys(...keys: string[]): void {
      invalidated = true;
      if (invalidatedKeys === null) invalidatedKeys = [];
      for (const k of keys) {
        if (!invalidatedKeys.includes(k)) invalidatedKeys.push(k);
      }
    },
    get invalidated(): boolean {
      return invalidated;
    },
    get invalidatedKeys(): string[] | null {
      return invalidatedKeys;
    },
  };
}
