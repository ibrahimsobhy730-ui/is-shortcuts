/* Writes public/version.json at build time: the build stamp the
   app's new-build notice polls (see useNewBuildNotice in
   components/App.tsx). The file is served as a static asset, so a
   running tab can tell a newer deploy exists without reloading.
   Run with: node scripts/write-version.mjs (called by the build
   and vercel-build scripts in package.json). */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
writeFileSync(
  join(root, "public", "version.json"),
  JSON.stringify({ builtAt: Date.now() }) + "\n",
);
console.log("version.json written.");
