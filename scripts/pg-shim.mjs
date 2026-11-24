// Test-only "pg" replacement for scripts/import-backup.ts under pg-mem.
// The harness sets globalThis.__pgMemClient / __pgMemPool to the
// pg-mem adapter classes of the target DB before importing the
// importer. Only Client is used by the importer.
export const Client = globalThis.__pgMemClient;
export const Pool = globalThis.__pgMemPool;
