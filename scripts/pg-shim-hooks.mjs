// Test-only module hooks: redirect the "pg" import to the pg-mem shim
// so scripts/import-backup.ts (which uses the real `pg` Client) runs
// against an in-memory target DB. Registered by
// scripts/verify-full-backup.mjs via module.register() before it
// dynamically imports the importer. Never used by the app itself.
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const shimUrl = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "pg-shim.mjs"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "pg") {
    return { url: shimUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
