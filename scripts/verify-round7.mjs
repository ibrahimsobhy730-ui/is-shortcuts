/* Static regression audit for the Round 7 visual redesign
   (2026-11-27): the owner's verdict on Round 5 was «مفيش
   تعديل واضح حصل» — so this round is structural, not polish.
   Checks:
   (1) UI font is IBM Plex Sans Arabic everywhere, Readex
       fully gone, Amiri only on the verse;
   (2) home first screen is ONE command deck (verse + stats /
       giant search / triggers + «جديد»), search moved out of
       the header, old plaque/strip gone;
   (3) auth explainer lives INSIDE .auth-split (form + demo
       side by side on desktop, demo first on mobile);
   (4) the removals still hold (AHK, starter pill, home
       completion panel) and Library Tools stays collapsed.
   Run with: node scripts/verify-round7.mjs */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const app = read("components/App.tsx");
const layout = read("app/layout.tsx");
const theme = read("app/theme.css");
const tokens = read("app/tokens.css");
const explainer = read("components/AuthExplainer.tsx");

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

/* ---- (1) Font: Plex everywhere, Amiri on the verse only ---- */
check(
  "layout imports IBM_Plex_Sans_Arabic (not Readex_Pro)",
  /import \{ Amiri, IBM_Plex_Sans_Arabic \} from "next\/font\/google"/.test(layout) &&
    !/Readex_Pro/.test(layout),
);
check(
  "no Readex string anywhere in app/ or components/",
  !/Readex/.test(layout + theme + tokens + app + explainer),
);
check(
  "no --font-readex variable anywhere",
  !/--font-readex/.test(layout + theme + tokens + app),
);
check(
  "theme --font-sans/--font-mono use --font-plex",
  /--font-sans: var\(--font-plex\), "IBM Plex Sans Arabic"/.test(theme) &&
    /--font-mono: var\(--font-plex\), "IBM Plex Sans Arabic"/.test(theme),
);
check(
  "body + headings use --font-plex",
  /body \{\n  font-family: var\(--font-plex\), "IBM Plex Sans Arabic"/.test(tokens) &&
    /h1, h2, h3, \.font-display, \.folder-bar-title \{\n  font-family: var\(--font-plex\), "IBM Plex Sans Arabic"/.test(tokens),
);
check(
  "Amiri appears in exactly one font-family rule: .verse",
  (tokens.match(/font-family:[^;]*amiri[^;]*;/gi) ?? []).length === 1 &&
    /\.verse \{ font-family: var\(--font-amiri\), "Amiri"/.test(tokens),
);
check(
  "verse H1 still uses the .verse class (Amiri); auth verse REMOVED by owner order Rev1 (2026-11-27)",
  /className="verse cmd-deck-verse/.test(app) &&
    !/auth-verse/.test(app),
);

/* ---- (2) Home command deck ---- */
check(
  "home has one .cmd-deck section (centered verse + counters line / search / triggers, no جديد)",
  (app.match(/className="cmd-deck /g) ?? []).length === 1 &&
    /cmd-deck-verse/.test(app) &&
    /cmd-deck-counters/.test(app) &&
    /cmd-deck-search/.test(app) &&
    /cmd-deck-bottom/.test(app) &&
    !/hero-stat/.test(app) &&
    !/cmd-deck-top/.test(app),
);
check(
  "search input lives inside the deck (ref after cmd-deck, not in header)",
  app.indexOf("cmd-deck") < app.indexOf("ref={searchWrapRef}") &&
    !/className="sticky top-0 z-40"[\s\S]*?ref=\{searchWrapRef\}[\s\S]*?<\/header>/.test(app),
);
check(
  "old plaque + strip gone from JSX",
  !/className="verse-hero/.test(app) && !/className="hero-strip/.test(app),
);
check(
  "deck styles exist in tokens.css (glow layer keeps overflow visible)",
  /\.cmd-deck \{/.test(tokens) &&
    /\.cmd-deck-glow \{/.test(tokens) &&
    /overflow: hidden;\n  border-radius: inherit;/.test(tokens),
);
check(
  "hero hide/show still wired (folds the hero into a slim strip)",
  /const \[heroHidden, setHeroHidden\]/.test(app) &&
    /heroHidden \? \(/.test(app) &&
    /toggleHero\(true\)/.test(app) &&
    /toggleHero\(false\)/.test(app) &&
    /cmd-deck-strip/.test(app),
);
check(
  "no «جديد» button in the deck (Step 2: sidebar primary is the only create action)",
  !/cmd-deck-bottom[\s\S]*?إضافة اختصار جديد/.test(app) &&
    /rail-new/.test(app) &&
    /إضافة اختصار جديد/.test(app),
);
check(
  "reply card crowns the trigger pill in the top action row",
  /Round 7 — the shortcut pill moves up here/.test(app),
);

/* ---- (3) Auth split: explainer inside .auth-split ---- */
check(
  "AuthExplainer mounted inside .auth-split, right after </main>",
  /<\/main>\n    \{\/\* Round 8 — لوحة العرض/.test(app) &&
    /<AuthExplainer lang=\{lang\} \/>\n    <\/div>\n    <\/div>\n  \);/.test(app),
);
check(
  "auth split CSS (Round 8): desktop two balanced panels 440px + 1fr at 1100px, top-aligned; no tablet/mobile-specific order (scope cut 19:13)",
  /@media \(min-width: 1100px\) \{\n  \.auth-r8 \.auth-split \{\n    grid-template-columns: 440px minmax\(0, 1fr\);\n    align-items: start;/.test(tokens) &&
    !/\.auth-r8 \.auth-r8-demo \{\n    order: -1;/.test(tokens) &&
    !/\.auth-split \.auth-explainer \{\n  order: -1;/.test(tokens),
);
check(
  "explainer demo present, static picture gone (Round 8: animated demo replaces it)",
  /\/شكرا/.test(explainer) &&
    !/explainer-popup-action/.test(explainer) &&
    !/auth-explainer-figure/.test(explainer) &&
    /مثال/.test(explainer) &&
    !/testimonial|شهادة/.test(explainer),
);
check(
  "extension download card in the explainer (owner override 2026-11-27 22:36: ZIP + install guide ON the site — the old no-extension rule is superseded by his explicit order)",
  /auth-r8-ext/.test(explainer) &&
    /is-shortcuts-extension\.zip/.test(explainer) &&
    /<ExtensionInstallGuide/.test(explainer),
);

/* ---- (4) Removals still hold; Library Tools stays collapsed ---- */
check(
  "AutoHotkey section still fully gone",
  !/buildAhk/.test(app) &&
    !/ahkEscape/.test(app) &&
    !/استخدام الاختصارات على ويندوز/.test(app) &&
    !/تنزيل ملف AutoHotkey/.test(app),
);
check(
  "starter-library pill still gone (picker + seeding kept)",
  !/مكتبة بداية · مختار/.test(app) &&
    /StarterLibraryPicker/.test(app),
);
check(
  "«أكمل اختصاراتك» panel still mounted exactly once (Shortcuts view only)",
  (app.match(/<CompleteShortcutsPanel/g) ?? []).length === 1,
);
check(
  "Library Tools still collapsed by default",
  /const \[toolsOpen, setToolsOpen\] = useState\(false\)/.test(app),
);
check(
  "shortcut pill + joined action group untouched",
  /trig-chip/.test(app) && /card-action-group/.test(app),
);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
