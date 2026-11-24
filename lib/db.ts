import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

/* Postgres connection for the Next.js port.
   DATABASE_URL comes from the environment (Vercel project settings on
   the deployed site, .env.local for local runs). It is the Neon
   connection string and MUST include ?sslmode=require — Neon refuses
   plain connections. No credential is ever hardcoded here.
   The pool is deliberately tiny (max 2): this is a single-user app
   on serverless functions, and the Neon free tier caps connections. */

let pool: Pool | null = null;
let db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set — add the Neon connection string to the environment (see .env.example)",
      );
    }
    pool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}

/** For tests and scripts that need a drizzle instance over an existing pool. */
export function dbForPool(existing: Pool): NodePgDatabase<typeof schema> {
  return drizzle(existing, { schema });
}
