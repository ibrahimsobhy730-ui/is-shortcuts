/* Static regression audit for Round 8 Rev1 (2026-11-27) — the login
   revision at the owner's call «طور واجهة تسجيل الدخول بشكل عام
   اكتر بكتير»: physical panel order (form right, demo left, AR and
   EN), demo developed much more, verse REMOVED from the auth form
   (home verse untouched), form look developed much more.
   Checks:
   (1) layout: two balanced panels (480px form track + demo hero) in
       a 1280px container at >=1100px; form physically right in BOTH
       languages; stacked below; desktop top-aligned so the submit
       button fits above the fold at 1440x900; no mobile/tablet-
       specific design (scope cut 19:13) — only basic no-breakage
       rules below 1100px;
   (2) the animated demo: AuthDemo state machine (16s loop,
       typing/popup/cursor/press/sent/success/montage/fade),
       customer question filling the early chat, step cards with
       their own text, step indicator + play/pause + reduced-motion
       static frame, popup re-opens in the montage so the new
       shortcut shows, sent bubble only in the success window;
   (3) the static figure is gone (animated demo replaces it) and
       its image file is deleted; extension download card + guide
       present (owner override 2026-11-27 22:36), no testimonial,
       fictional examples only;
   (4) form: verse REMOVED from the auth form (home verse stays,
       Amiri, exact string), title 32/800, logo medallion +
       product name, deep submit gradient in both themes, mode swap
       via grid-rows + data-open (no key={mode}), noValidate (hidden
       required fields must not trip native validation), 52px fields,
       54px submit, utility glass pill;
   (5) auth page ONLY: no changes to home/app logic; font still
       IBM Plex Sans Arabic (no Readex), verse Amiri only.
   Run with: node scripts/verify-round8.mjs */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const app = read("components/App.tsx");
const tokens = read("app/tokens.css");
const explainer = read("components/AuthExplainer.tsx");
const demo = read("components/AuthDemo.tsx");
const layout = read("app/layout.tsx");

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

/* ---- (1) Layout: two balanced panels, desktop top-aligned ---- */
check(
  "desktop split: 480px form track + 1fr demo at 1100px, max-width 1280px",
  /\.auth-r8 \.auth-split \{\n    grid-template-columns: 480px minmax\(0, 1fr\);/.test(tokens) &&
    /max-width: 1280px;/.test(tokens) &&
    /@media \(min-width: 1100px\)/.test(tokens),
);
check(
  "physical order: form on the physical right in LTR too (no mirroring)",
  /html\[dir="ltr"\] \.auth-r8 \.auth-split \{ grid-template-columns: minmax\(0, 1fr\) 480px;/.test(tokens) &&
    /html\[dir="ltr"\] \.auth-r8 \.auth-split \.auth-form-side \{ grid-column: 2; grid-row: 1;/.test(tokens) &&
    /html\[dir="ltr"\] \.auth-r8 \.auth-split \.auth-r8-demo \{ grid-column: 1; grid-row: 1;/.test(tokens) &&
    /html\[dir="ltr"\] \.auth-r8 \.auth-r8-demo \{ border-inline-start: none; border-inline-end: 1px solid var\(--border\);/.test(tokens),
);
check(
  "desktop top-aligned (submit fits above the fold at 1440x900)",
  /\.auth-r8 \.auth-split \{\n    grid-template-columns: 480px minmax\(0, 1fr\);\n    align-items: start;/.test(tokens),
);
check(
  "demo column capped at 680px (stage is bigger than Round 8)",
  /max-width: 680px;/.test(tokens) &&
    /\.auth-r8 \.auth-r8-demo \{/.test(tokens),
);
check(
  "stacked below 1100px with min-width: 0 (no grid blowout)",
  /@media \(max-width: 1099px\)/.test(tokens) &&
    /\.auth-r8 \.auth-r8-demo \{[^}]*min-width: 0;/.test(tokens),
);
check(
  "scope cut 19:13: no tablet demo-first order, no tablet 16/9 stage, no mobile brand header",
  !/\.auth-r8 \.auth-r8-demo \{\n    order: -1;/.test(tokens) &&
    !/aspect-ratio: 16 \/ 9;/.test(tokens) &&
    !/auth-r8-topbrand/.test(tokens) &&
    !/auth-r8-topbrand/.test(app),
);
check(
  "narrow widths: only basic no-breakage (stage 4/3 so the popup is never clipped)",
  /@media \(max-width: 767px\) \{\n  \.auth-r8 \.auth-topbar \{/.test(tokens) &&
    /\.auth-r8-stage \{\n    aspect-ratio: 4 \/ 3;/.test(tokens) &&
    !/\.auth-r8-montage \{\n    display: none;/.test(tokens),
);

/* ---- (2) Animated demo: state machine + controls ---- */
check(
  "demo loop constants: 16s, typing/popup/cursor/press/sent/success/montage/fade",
  /LOOP_MS = 16000/.test(demo) &&
    /TYPE_AT/.test(demo) &&
    /POPUP_AT/.test(demo) &&
    /CURSOR_AT/.test(demo) &&
    /PRESS_AT/.test(demo) &&
    /SENT_AT/.test(demo) &&
    /SUCCESS_AT/.test(demo) &&
    /MONTAGE_AT/.test(demo) &&
    /FADE_AT/.test(demo),
);
check(
  "step-jump resets the interval origin (jump works while playing)",
  /startRef\.current = performance\.now\(\) - ms;/.test(demo),
);
check(
  "popup re-opens in the montage so the new shortcut is visible",
  /const popupOpen = \(t >= POPUP_AT && t < 9000\) \|\| t >= MONTAGE_AT;/.test(demo),
);
check(
  "sent bubble only in the success window (never behind the open popup, never under the montage)",
  /const bubbleShown = t >= SUCCESS_AT && t < MONTAGE_AT;/.test(demo),
);
check(
  "demo head uses its own title/sub classes (Round 8 defined them but never applied them)",
  /className="auth-r8-demo-title"/.test(explainer) &&
    /className="auth-r8-demo-sub"/.test(explainer) &&
    /\.auth-r8-demo-title \{ font-size: clamp\(32px, 3\.4vw, 38px\); font-weight: 800;/.test(tokens),
);
check(
  "mock customer question fills the early chat (stage is no longer an empty box)",
  /ممكن أسعار الباقات؟/.test(demo) &&
    /auth-r8-bubble-q/.test(demo) &&
    /t >= 600/.test(demo),
);
check(
  "step cards carry their own text (no separate caption line)",
  /auth-r8-step-text/.test(demo) &&
    /auth-r8-step-top/.test(demo) &&
    !/auth-r8-step-caption/.test(demo),
);
check(
  "try-it framed as one composed card under the demo",
  /\.auth-r8-try \{\n  margin-top: 16px;\n  padding: 16px 18px 14px;\n  border-radius: 20px;\n  border: 1px solid var\(--border\);\n  background: var\(--surface\);/.test(tokens),
);
check(
  "demo controls: play/pause, step jump, tab-hidden + offscreen pause, reduced-motion static frame",
  /aria-label=\{[^}]*تشغيل|إيقاف/.test(demo) &&
    /document\.hidden/.test(demo) &&
    /IntersectionObserver/.test(demo) &&
    /prefers-reduced-motion/.test(demo) &&
    /const t = reduced \? SUCCESS_AT \+ 100 : elapsed;/.test(demo),
);
check(
  "demo exposes phase + playing state for tests",
  /data-phase=\{activeStep\}/.test(demo) &&
    /data-playing=\{running \? "1" : "0"\}/.test(demo),
);
check(
  "demo mock data only (fictional examples, no real replies)",
  /\/شكرا/.test(demo) &&
    /RESULTS = \[/.test(demo) &&
    !/1472955|1472977/.test(demo),
);
check(
  "popup surface is SOLID (no bleed-through of the chat behind it — Rev2: the 94%/98% glass still ghosted, measured alpha 0.90)",
  /\.auth-r8-popup \{[^}]*background: rgb\(from var\(--surface-elevated\) r g b \/ 1\);/.test(tokens) &&
    /\.auth-r8-montage-chip \{[^}]*background: rgb\(from var\(--surface-elevated\) r g b \/ 1\);/.test(tokens),
);
check(
  "cursor lives inside the popup, on the first row (top 60px)",
  /\.auth-r8-cursor \{\n  position: absolute;\n  z-index: 4;\n  \/\* داخل النافذة/.test(tokens) &&
    /top: 60px;/.test(tokens),
);

/* ---- (3) Static figure gone, image deleted, extension card + guide present, no testimonial ---- */
check(
  "static figure gone from the explainer (animated demo replaces it)",
  !/auth-explainer-figure/.test(explainer) &&
    !/explainer-popup-action/.test(explainer) &&
    !existsSync(join(root, "public", "images", "explainer-popup-action.png")),
);
check(
  "extension download card in the explainer (owner override 2026-11-27 22:36: ZIP + install guide ON the site — the old no-extension rule is superseded by his explicit order)",
  /auth-r8-ext/.test(explainer) &&
    /is-shortcuts-extension\.zip/.test(explainer) &&
    /<ExtensionInstallGuide/.test(explainer),
);
check(
  "fictional examples only, labeled as examples",
  /مثال/.test(explainer) &&
    !/testimonial|شهادة/.test(explainer),
);
check(
  "try-it box kept under the demo with example pills",
  /جرّب بنفسك/.test(explainer) &&
    /\/مواعيد/.test(explainer) &&
    /\/سعر/.test(explainer),
);

/* ---- (4) Form: verse REMOVED from auth, title, swap, noValidate, sizes, utility pill ---- */
check(
  "verse REMOVED from the auth form (home verse untouched, Amiri, exact string)",
  !/auth-r8-verse-frame/.test(app) &&
    !/auth-r8-verse-frame/.test(tokens) &&
    !/auth-verse/.test(app) &&
    /نِعْمَةً مِّنْ عِندِنَا/.test(app) &&
    /cmd-deck-verse/.test(app) &&
    !/نِعْمَةً/.test(tokens),
);
check(
  "title 32px/800, logo medallion + product name, card glow, logo breathing glow",
  /\.auth-r8 \.auth-title \{ font-size: 32px; font-weight: 800;/.test(tokens) &&
    /auth-r8-logo-ring/.test(tokens) &&
    /auth-r8-brandline/.test(app) &&
    /auth-r8-card-glow/.test(tokens) &&
    /auth-r8-breathe/.test(tokens),
);
check(
  "submit is a deep gradient in both themes (dark-mode pale pill fixed), white label",
  /\.auth-r8 \.auth-submit \{\n  background: linear-gradient\(165deg, color-mix\(in srgb, var\(--accent\) 72%, black 28%\) 0%, color-mix\(in srgb, var\(--accent\) 60%, black 40%\) 100%\);\n  color: oklch\(0\.99 0\.01 250\);/.test(tokens),
);
check(
  "fields get a focus glow (accent ring + soft halo)",
  /\.auth-r8 \.auth-input:focus \{\n  border-color: color-mix\(in srgb, var\(--accent\) 55%, transparent\);\n  box-shadow:\n    0 0 0 3px color-mix\(in srgb, var\(--accent\) 16%, transparent\),/.test(tokens),
);
check(
  "mode swap via grid-rows + data-open (no key={mode} remount)",
  /className="auth-r8-swap/.test(app) &&
    /data-open=\{mode === "register"\}/.test(app) &&
    !/key=\{mode\}/.test(app) &&
    /\.auth-r8-swap\[data-open="false"\] \{\n  grid-template-rows: 0fr;/.test(tokens),
);
check(
  "closed swap cancels the flex gap (margin-block = -gap/2 per side, -16 total)",
  /\.auth-r8-swap\[data-open="false"\] \{[^}]*margin-block: -8px;/.test(tokens),
);
check(
  "form has noValidate (hidden required fields must not trip native validation)",
  /<form[^>]*noValidate/.test(app),
);
check(
  "fields 52px, submit 54px/16/600, show/hide 48px target, remember row 48px",
  /\.auth-r8 \.auth-input \{\n  min-height: 52px;/.test(tokens) &&
    /\.auth-r8 \.auth-submit \{\n  min-height: 54px;\n  border-radius: 18px;\n  font-size: 16px;\n  font-weight: 600;/.test(tokens) &&
    /width: 48px;\n  height: 48px;/.test(tokens),
);
check(
  "utility pill: one glass pill, LangToggle + theme, 48px targets",
  /className="auth-r8-util"/.test(app) &&
    /className="auth-r8-util-lang"/.test(app) &&
    /backdrop-filter: blur\(20px\) saturate\(160%\);/.test(tokens),
);
check(
  "champagne gold only as tiny details (step numbers + logo-ring hairline)",
  /--r8-champ/.test(tokens) &&
    !/background: var\(--gold\)|background: var\(--champ\)/.test(tokens),
);

/* ---- (5) Auth page ONLY + font still Plex ---- */
check(
  "font: IBM Plex Sans Arabic kept, zero Readex strings",
  /IBM Plex Sans Arabic/.test(layout) &&
    !/Readex/.test(app) &&
    !/Readex/.test(tokens) &&
    !/Readex/.test(layout),
);
check(
  "Amiri in exactly one font-family rule (the verse)",
  (tokens.match(/font-family:[^;]*Amiri/g) || []).length === 1,
);
check(
  "no new heavy dependency for the demo (HTML/CSS/SVG/JS only)",
  !/from ["'](lottie[^"']*|@lottiefiles|rives?|framer-motion|@rive-app)["']/.test(demo) &&
    !/from ["'](lottie[^"']*|@lottiefiles|rives?|framer-motion|@rive-app)["']/.test(app) &&
    !/["'](lottie[^"']*|framer-motion)["']\s*:/.test(read("package.json")),
);

/* ---- (6) Rev3: logo centered in its ring + direction-aware LTR padding ---- */
check(
  "logo span wraps the svg exactly (Rev3: mark centered in the ring)",
  /\.auth-r8-logo \.logo-modern \{[^}]*width: auto !important;[^}]*height: auto !important;/.test(tokens),
);
check(
  "LTR inputs pad the icon side per document direction (Rev3: AR right, EN left)",
  /\.app-shell\[dir="rtl"\] \.auth-r8 \.auth-input\[dir="ltr"\] \{[^}]*padding-inline-end: 40px;/.test(tokens) &&
    /\.app-shell\[dir="ltr"\] \.auth-r8 \.auth-input\[dir="ltr"\] \{[^}]*padding-inline-start: 40px;/.test(tokens),
);

/* ---- (7) Step 2: simplified home banner + header actions ---- */
check(
  "deck hero is one centered composition (verse + ornamental divider + one counters line)",
  /cmd-deck-hero/.test(app) &&
    /orn-divider cmd-deck-divider/.test(app) &&
    /cmd-deck-counters/.test(app) &&
    /\.cmd-deck-verse \{[^}]*text-align: center;/.test(tokens) &&
    /\.cmd-deck-counters \{[^}]*font-size: 13px;/.test(tokens),
);
check(
  "collapsed banner is a slim strip (52px, verse fragment + counters + show button)",
  /cmd-deck-strip/.test(app) &&
    /\.cmd-deck-strip \{[^}]*min-height: 52px;/.test(tokens) &&
    /\.cmd-deck-strip-counters \{[^}]*display: none;/.test(tokens),
);
check(
  "hide button is truly absolute (Step 2: the data-tip tooltip rule wins over a plain class)",
  /cmd-deck-hide absolute/.test(app),
);
check(
  "no «جديد» button in the deck; sidebar primary + rail still create a new reply",
  !/cmd-deck-bottom[\s\S]*?إضافة اختصار جديد/.test(app) &&
    /rail-new/.test(app),
);
check(
  "hero-stat pills are gone (CSS + JSX) — counters are one quiet line now",
  !/\.hero-stat \{/.test(tokens) && !/hero-stat/.test(app),
);
check(
  "header fits at 390px (Step 2: tighter small-screen gap/padding, no clip)",
  /float-header mx-auto flex h-\[68px\] w-full max-w-\[88rem\] items-center gap-1\.5 px-2\.5/.test(app),
);
check(
  "header «اختصار سريع» still opens the glass ShortcutBar (pick + copy, search inside, empty state)",
  /function ShortcutBar/.test(app) &&
    /glass-panel/.test(app) &&
    /مفيش اختصار بيطابق اللي كتبته/.test(app) &&
    /لسه مفيش اختصارات/.test(app),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
