/* Static regression audit for the 2026-11-26 redesign round
   (upload diagnostics, shortcut-mark redesign, pin/edit/delete
   grouping, context-menu dismiss, new-build notice):
   (1) shortcut-mark distinctness — the shortcut mark is the
   site's own solid filled bolt (ShortcutBolt), never Zap and
   never any folder/reply glyph; the pill/hero-pill are solid
   NEBULA capsules (radius 999px, --trig-pill-bg, white ink),
   never the ⌘ keycap and never folder-tinted;
   (2) pin/edit/delete grouped — the three management actions sit
   in one .card-action-group on the card and in the details panel;
   delete is out of the ⋯ menu; the ⋯ keeps only preview +
   duplicate;
   (3) context-menu dismiss — the tree actions menu closes on
   Escape and on mousedown-outside (usePopoverDismiss), not only
   on a backdrop click.
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

// ---- (1) the shortcut mark: solid filled bolt ----
check("I.shortcut is ShortcutBolt", /shortcut:\s*ShortcutBolt as unknown as LucideIcon,/.test(app));
check(
  "ShortcutBolt is a filled SVG bolt (currentColor, own path)",
  /function ShortcutBolt\(\{ size = 18 \}/.test(app) &&
    /fill="currentColor"/.test(app) &&
    /d="M13 2 L5 13\.2 H10\.2 L9\.2 22 L19 10\.8 H13\.8 L13 2 Z"/.test(app),
);
check(
  "Command is gone (no import, no I.shortcut = Command)",
  !/^Command,$/m.test(app) && !/shortcut:\s*Command,/.test(app),
);
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
check(
  "folder-colour pill is gone: no triggerPillFolder / trig-folder in TSX or CSS",
  !/triggerPillFolder/.test(app.replace(/The folder-colour pill \(triggerPillFolder\) was REMOVED[\s\S]*?folder TILES still wear them\. \*\//, "")) &&
    !/trig-folder/.test(app) &&
    !/trig-folder/.test(panel) &&
    !/trig-folder/.test(editor) &&
    !/\.trig-icon\.trig-folder|\.trig-hero-pill\.trig-folder|\.trig-chip\.trig-folder/.test(css),
  "a trig-folder reference survived",
);
check(
  "no folder prop passed to TriggerIcon anywhere",
  !/<TriggerIcon[^>]*folder=/.test(app) && !/<TriggerIcon[^>]*folder=/.test(panel),
);

// ---- (1b) solid capsule shape + sheen that starts fast ----
const trigIcon = /\.trig-icon \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("pill is a capsule: radius 999px", /border-radius: 999px;/.test(trigIcon));
check(
  "pill uses the solid NEBULA gradient + white ink",
  /background: var\(--trig-pill-bg\);/.test(trigIcon) && /color: #ffffff;/.test(trigIcon),
);
check(
  "pill has NO keycap bottom edge",
  !/inset 0 -2px 0/.test(trigIcon),
);
check(
  "--trig-pill-bg defined in light and dark",
  (css.match(/--trig-pill-bg: linear-gradient\(135deg, #1c40aa, #1668c4 60%, #2b7cd3\);/g) ?? []).length >= 1 &&
    (css.match(/--trig-pill-bg: linear-gradient\(135deg, #2f7de1, #1e63c8 60%, #2b6fe0\);/g) ?? []).length >= 2,
);
const hero = /\.trig-hero-pill \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("hero pill is a capsule: radius 999px", /border-radius: 999px;/.test(hero));
check(
  "hero pill uses the solid gradient + white ink",
  /background: var\(--trig-pill-bg\);/.test(hero) && /color: #ffffff;/.test(hero),
);
check(
  "hero pill has NO keycap bottom edge",
  !/inset 0 -2px 0/.test(hero),
);
const chip = /\.trig-chip \{[^}]*\}/s.exec(css)?.[0] ?? "";
check("chip is a capsule: radius 999px", /border-radius: 999px;/.test(chip));
check(
  "chip has NO keycap bottom edge",
  !/inset 0 -2px 0/.test(chip),
);
check(
  "active chip is the solid gradient with white text",
  /\.trig-chip-active \{[^}]*background: var\(--trig-pill-bg\);[^}]*color: #ffffff;/.test(css),
);
check(
  "empty pill keeps the capsule radius (inherits .trig-icon)",
  /\.trig-icon-empty \{[^}]*box-shadow: none;[^}]*\}/s.test(css),
);
check(
  "sheen stagger capped at 0.5s (was up to 2.4s — a pill could sit still for a whole 2s window)",
  /\(item\.id % 3\) \* 0\.25/.test(app) && !/\(item\.id % 7\) \* 0\.4/.test(app),
);
check(
  "sheen animation + keyframes present in CSS",
  /\.trig-sheen \{[^}]*animation:[^}]*neb-trig-sheen[^}]*\}/s.test(css) &&
    /@keyframes neb-trig-sheen \{[\s\S]*?translateX\(-110%\)[\s\S]*?translateX\(110%\)/.test(css),
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

// ---- (3) context-menu dismiss: Escape + mousedown-outside ----
check(
  "ctxMenu wired to usePopoverDismiss (Escape + mousedown-outside)",
  /usePopoverDismiss\(ctxMenu !== null, \[ctxMenuRef\], \(\) => \{\s*setCtxMenu\(null\);\s*setCtxMoveOpen\(false\);\s*\}\);/.test(app),
);
check(
  "ctxMenu panel carries the dismiss ref",
  /<div\s*ref=\{ctxMenuRef\}\s*role="menu"/.test(app),
);
check(
  "ctxMenu backdrop click still closes (second layer)",
  /<div className="fixed inset-0 z-\[var\(--z-menu\)\]" role="presentation" onClick=\{\(\) => setCtxMenu\(null\)\}/.test(app),
);

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
