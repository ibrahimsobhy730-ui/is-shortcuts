/* Static regression audit for the 2026-11-26 round infrastructure:
   (1) new-build notice — public/version.json is written at build
   time and the app polls it, offering one quiet reload when a
   newer deploy exists (the stale-tab root cause: the user
   photographed an OLD build's error wording minutes after a
   deploy because the open tab never reloaded);
   (2) service worker cache bumped to is-cache-v10 so old chunk
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
  "service worker cache is v10 (old chunk caches purge on activate)",
  /const CACHE = "is-cache-v10";/.test(sw) && !/is-cache-v9/.test(sw),
);
check(
  "login form never flashes during session restore (Round 5)",
  /const \[restored, setRestored\] = useState\(false\);/.test(app) &&
    /setRestored\(true\);/.test(app) &&
    /\(!restored \|\| \(token && meQuery\.isPending\)\)/.test(app),
);
// ---- first screen is visibly new (Round 5b, 2026-11-27): the
// owner felt NO development from the subtle polish, so the home
// first screen must read different at a glance — bigger verse,
// glass stat pills instead of the plain counter line, a taller
// blue-ringed search, and a gradient «جديد» button. These
// checks pin the visible markers so a later round cannot
// silently shrink the home back.
const tokens = read("app/tokens.css");
check(
  "hero verse is bigger (clamp to 54px) with stat pills",
  /text-\[clamp\(32px,5\.4vw,54px\)\]/.test(app) &&
    /className="hero-stat"/.test(app) &&
    /\.hero-stat \{/.test(tokens) &&
    /\.hero-stat b \{/.test(tokens),
);
check(
  "hero stat pills show replies, folders and shortcuts counts",
  /<b>\{shortcuts\.length\}<\/b>/.test(app) &&
    /<b>\{folderCount\}<\/b>/.test(app) &&
    /<b>\{withTriggerCountHome\}<\/b>/.test(app),
);
check(
  "search is hero-sized with a permanent accent ring",
  /h-14 w-full rounded-full/.test(app) &&
    /sm:h-\[60px\]/.test(app) &&
    /border-\[color-mix\(in_srgb,var\(--accent\)_38%,var\(--border\)\)\]/.test(app),
);
check(
  "«جديد» is a gradient hero button, chips are bigger",
  /lux-btn btn-lux flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-7 py-3\.5 text-\[15px\] font-bold/.test(app) &&
    /\.trig-chip \{\s*padding: 7px 14px;\s*font-size: 14px;/.test(tokens),
);
// ---- auth explainer (Round 5c, 2026-11-27): an interactive
// live demo + how-it-works sits BELOW the sign-in form on
// BOTH login and register pages. Hard rules pinned here:
// no extension mention, no invented testimonial, demo
// samples clearly labeled as examples, form stays first.
const explainer = read("components/AuthExplainer.tsx");
check(
  "explainer renders below the auth form on both modes",
  /import AuthExplainer from "\.\/AuthExplainer";/.test(app) &&
    /<AuthExplainer lang=\{lang\} \/>/.test(app) &&
    // outside the mode conditional: placed after the auth-split
    // close, so login AND register both show it.
    app.indexOf("<AuthExplainer") > app.indexOf("</main>"),
);
check(
  "demo really works: typewriter, exact-match reveal, real copy",
  /window\.setTimeout\(step, 45\)/.test(explainer) &&
    /EXAMPLES\.find\(\(e\) => e\.trigger === q\)/.test(explainer) &&
    /search-trig-expand-open/.test(explainer) &&
    /navigator\.clipboard\.writeText\(match\.body\)/.test(explainer),
);
check(
  "demo samples are labeled examples, never real replies",
  /أمثلة للتوضيح/.test(explainer) &&
    /Example/.test(explainer) &&
    /دي أمثلة للتوضيح بس/.test(explainer),
);
check(
  "explainer mentions no extension and no testimonial",
  !/extension/i.test(explainer) &&
    !/اكستنشن/i.test(explainer) &&
    !/إضافة المتصفح|إضافة كروم/i.test(explainer) &&
    !/testimonial|★★★★★|⭐/.test(explainer),
);
check(
  "explainer covers steps, adding a shortcut, and core features",
  /اكتب الاختصار/.test(explainer) &&
    /إضافة اختصار بتاخد ثواني/.test(explainer) &&
    /بحث فوري يفهم العربي/.test(explainer) &&
    /صور مع الرد/.test(explainer) &&
    /\.auth-explainer \{/.test(tokens),
);
check(
  "reference image is in the repo and framed in the explainer",
  existsSync(join(root, "public", "images", "explainer-live-preview.png")) &&
    existsSync(join(root, "public", "images", "explainer-popup-action.png")) &&
    /src="\/images\/explainer-live-preview\.png"/.test(explainer) &&
    /src="\/images\/explainer-popup-action\.png"/.test(explainer) &&
    /auth-explainer-figure/.test(explainer) &&
    /\.auth-explainer-figure \{/.test(tokens) &&
    /\.auth-explainer-figure img \{/.test(tokens),
);
check(
  "starter-library pill is gone from home AND Shortcuts top",
  !/starterQueryHome/.test(app) &&
    !/starterQuery\.data\?\.isOwner/.test(app) &&
    !/مختار \$\{.*chosen\.length\}/.test(app),
);
check(
  "starter picker and seeding stay untouched",
  /id="starter-library"/.test(app) &&
    /function StarterLibraryPicker/.test(app) &&
    /api\.getStarterLibrary/.test(app),
);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
