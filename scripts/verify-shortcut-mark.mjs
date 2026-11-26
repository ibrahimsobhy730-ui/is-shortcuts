/* Static regression audit for the two 2026-11-26 workstreams that
   have no runtime surface in Node:
   (1) shortcut-mark distinctness — the shortcut mark is ⌘
   (I.shortcut = Command), never Zap and never any folder/reply
   glyph; the pill/chip/hero-pill are keycap-shaped (8px + bottom
   edge), not round pills;
   (2) pin/edit/delete grouped — the three management actions sit
   in one .card-action-group on the card and in the details panel;
   delete is out of the ⋯ menu; the ⋯ keeps only preview +
   duplicate.
   Run with: node scripts/verify-shortcut-mark.mjs */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const app = read("components/App.tsx");
const css = read("app/tokens.css");
const panel = read("components/modals/DetailsPanel.tsx");
const editor = read("components/modals/EditorModal.tsx");

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

// ---- (1) the shortcut mark ----
check("I.shortcut is Command", /shortcut:\s*Command,/.test(app));
check(
  "no I.zap usage anywhere (mark only)",
  !/I\.zap/.test(app) && !/I\.zap/.test(panel) && !/I\.zap/.test(editor),
  "I.zap still referenced",
);
check("no trig-zap class left", !/trig-zap/.test(app) && !/trig-zap/.test(css));
check(
  "no neb-trig-zap keyframes left",
  !/neb-trig-zap/.test(css),
);
check(
  "Zap stays a FOLDER-picker choice only (key \"zap\")",
  /key:\s*"zap",\s*icon:\s*Zap/.test(app),
);
check(
  "Command is not a folder-picker key",
  !/key:\s*"command"/.test(app),
);
check(
  "Command is not a CATEGORY_META auto icon",
  !/CATEGORY_META[\s\S]*?Command/.test(app.split("const FOLDER_ICON_OPTIONS")[0]),
);
check(
  "Keyboard (Tools tile) is NOT the shortcut mark",
  /keyboard:\s*Keyboard,/.test(app) && !/shortcut:\s*Keyboard/.test(app),
);
check(
  "TriggerIcon renders I.shortcut",
  /<Icon d=\{I\.shortcut\} size=\{size === "compact" \? 13 : 14\} \/>/.test(app),
);
check(
  "search-preview hero pill renders I.shortcut",
  /<Icon d=\{I\.shortcut\} size=\{13\} \/>/.test(app),
);
check(
  "shortcut-bar dialog header renders I.shortcut",
  /<Icon d=\{I\.shortcut\} size=\{19\} \/>/.test(app),
);
check(
  "MyShortcutsCard header renders I.shortcut",
  (app.match(/<Icon d=\{I\.shortcut\} size=\{15\} \/>/g) ?? []).length >= 4,
  `${(app.match(/<Icon d=\{I\.shortcut\} size=\{15\} \/>/g) ?? []).length} size-15 marks`,
);
check(
  "editor trigger label renders I.shortcut",
  /labelWithIcon\(I\.shortcut,/.test(editor),
);

// ---- (1b) keycap shape ----
const trigIcon = /\.trig-icon \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("pill is a keycap: radius 8px", /border-radius: 8px;/.test(trigIcon));
check(
  "pill has the key bottom edge",
  /inset 0 -2px 0 color-mix\(in srgb, var\(--trig\) 38%, transparent\)/.test(trigIcon),
);
const trigFolder = /\.trig-icon\.trig-folder \{[^}]*\}/s.exec(css)?.[0] ?? "";
check(
  "folder-tinted pill keeps the key edge (fhue)",
  /inset 0 -2px 0 color-mix\(in srgb, var\(--fhue\) 38%, transparent\)/.test(trigFolder),
);
const hero = /\.trig-hero-pill \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("hero pill is a keycap: radius 8px", /border-radius: 8px;/.test(hero));
check(
  "hero pill has the key bottom edge",
  /inset 0 -2px 0 color-mix\(in srgb, var\(--trig\) 38%, transparent\)/.test(hero),
);
const chip = /\.trig-chip \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("chip is a keycap: radius 8px", /border-radius: 8px;/.test(chip));
check(
  "chip has the key bottom edge",
  /inset 0 -2px 0 color-mix\(in srgb, var\(--trig\) 30%, transparent\)/.test(chip),
);
check(
  "empty pill keeps the keycap radius (inherits .trig-icon)",
  /\.trig-icon-empty \{[^}]*box-shadow: none;[^}]*\}/s.test(css),
);

// ---- (2) pin / edit / delete grouped ----
const groupCss = /\.card-action-group \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("group CSS exists: one pill, dividers", /border-radius: 9999px;/.test(groupCss) && /\.card-action-group > button \+ button \{ border-inline-start: 1px solid var\(--border\); \}/.test(css));
check(
  "group CSS: pinned state from aria-pressed",
  /\.card-action-group > button\[aria-pressed="true"\] \{ background: var\(--accent-soft\); color: var\(--accent\); \}/.test(css),
);
check(
  "group CSS: danger hover + confirm states",
  /\.card-action-danger-confirm \{ background: var\(--danger-soft\); color: var\(--danger\); font-weight: 700; \}/.test(css),
);
check(
  "card: group holds pin + edit + delete in order",
  /card-action-group[\s\S]*?I\.pin[\s\S]*?I\.edit[\s\S]*?I\.trash[\s\S]*?<\/div>\s*<\/div>/.test(app),
);
check(
  "card: star stays OUTSIDE the group (separate button before it)",
  /I\.star\} size=\{18\}[\s\S]{0,400}?card-action-group/.test(app),
);
check(
  "card: ⋯ menu has only preview + duplicate (no trash)",
  (() => {
    const m = /card-actions[\s\S]*?<\/div>\s*\n\s*<\/div>/.exec(app);
    return m !== null && !/I\.trash/.test(m[0]) && /I\.eye/.test(m[0]) && /I\.dup/.test(m[0]);
  })(),
);
check(
  "card: delete keeps the two-tap confirm inside the group",
  /card-action-group[\s\S]*?confirmingDelete[\s\S]*?onDelete\(item\)/.test(app),
);
check(
  "details panel: group holds pin + edit + delete in order",
  /card-action-group[\s\S]*?I\.pin[\s\S]*?I\.edit[\s\S]*?I\.trash[\s\S]*?<\/div>/.test(panel),
);
check(
  "details panel: star stays OUTSIDE the group",
  /<\/div>\s*<button[\s\S]*?I\.star[\s\S]*?مفضلة/.test(panel),
);
check(
  "details panel: delete has its own two-tap confirm",
  /confirmingDelete[\s\S]*?onDelete\(\)/.test(panel),
);
check(
  "details panel: onDelete wired to trash + close in App",
  /onDelete=\{\(\) => \{\s*deleteMut\.mutate\(detailFresh\.id\);\s*setDetailItem\(null\);\s*\}\}/.test(app),
);
check(
  "details panel: onDelete prop declared",
  /onDelete: \(\) => void;/.test(panel),
);
check(
  "compact row untouched (no delete in compact — space)",
  (() => {
    const start = app.indexOf('{density === "compact" ? (');
    const end = app.indexOf('<div className={density === "grid"', start);
    if (start === -1 || end === -1) return false;
    return !/I\.trash/.test(app.slice(start, end));
  })(),
);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
