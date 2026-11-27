/* Static regression audit for the 2026-11-26 round infrastructure:
   (1) new-build notice — public/version.json is written at build
   time and the app polls it, offering one quiet reload when a
   newer deploy exists (the stale-tab root cause: the user
   photographed an OLD build's error wording minutes after a
   deploy because the open tab never reloaded);
   (2) service worker cache bumped to is-cache-v7 so old chunk
   caches are purged when the new worker activates.
   Run with: node scripts/verify-version-check.mjs */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const app = read("components/App.tsx");
const pkg = read("package.json");
const sw = read("public/sw.js");
const writer = read("scripts/write-version.mjs");

let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

check("scripts/write-version.mjs exists", existsSync(join(root, "scripts", "write-version.mjs")));
check(
  "writer emits { builtAt } to public/version.json",
  /writeFileSync\(\s*join\(root, "public", "version\.json"\),\s*JSON\.stringify\(\{ builtAt: Date\.now\(\) \}\)/.test(writer),
);
check(
  "build script writes the version stamp first",
  /"build": "node scripts\/write-version\.mjs && next build"/.test(pkg),
);
check(
  "vercel-build writes the version stamp first",
  /"vercel-build": "node scripts\/write-version\.mjs && node --experimental-strip-types scripts\/setup-db\.ts && next build"/.test(pkg),
);
check(
  "useNewBuildNotice polls /version.json no-store every 60s",
  /fetch\(`\/version\.json\?x=\$\{Date\.now\(\)\}`, \{ cache: "no-store" \}\)/.test(app) &&
    /window\.setInterval\(\(\) => void check\(\), 60000\)/.test(app),
);
check(
  "notice compares builtAt and only fires on a NEWER stamp",
  /if \(loadedAt\.current === null\) loadedAt\.current = builtAt;/.test(app) &&
    /else if \(builtAt > loadedAt\.current && alive\) setAvailable\(true\);/.test(app),
);
check(
  "notice never auto-reloads (reload only on the button)",
  /onClick=\{\(\) => window\.location\.reload\(\)\}/.test(app) &&
    !/window\.location\.reload\(\)/.test(app.replace(/onClick=\{\(\) => window\.location\.reload\(\)\}/, "")),
);
check(
  "notice is dismissible and never nags after dismiss",
  /show: available && !dismissed, dismiss: \(\) => setDismissed\(true\)/.test(app),
);
check(
  "notice renders the Arabic reload banner",
  /في نسخة جديدة من الموقع — حدّث الصفحة عشان تشوف آخر التعديلات/.test(app) &&
    /حدّث دلوقتي/.test(app),
);
check(
  "notice is wired in App (hook called, banner rendered)",
  /const newBuild = useNewBuildNotice\(\);/.test(app) &&
    /\{newBuild\.show && \(/.test(app),
);
check(
  "service worker cache is v7 (old chunk caches purge on activate)",
  /const CACHE = "is-cache-v7";/.test(sw) && !/is-cache-v6/.test(sw),
);
check(
  "login form never flashes during session restore (Round 5)",
  /const \[restored, setRestored\] = useState\(false\);/.test(app) &&
    /setRestored\(true\);/.test(app) &&
    /\(!restored \|\| \(token && meQuery\.isPending\)\)/.test(app),
);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
