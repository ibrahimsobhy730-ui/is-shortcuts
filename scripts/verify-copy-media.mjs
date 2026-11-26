/* Test-only check of the pure copy-planning helpers in
   components/copy-media.ts (no DOM, no browser, no clipboard):
   the copy truth table (text only / text+image), button labels,
   toast wording and sizes. IMAGES ONLY — video was cancelled by
   the owner 2026-11-26, so there is no video plan, no video
   toast and no download step anymore.
   The browser parts (ClipboardItem write, canvas conversion)
   live in components/App.tsx and must be verified live; this
   script proves the decisions they are built on.
   Usage: node scripts/verify-copy-media.mjs */

import {
  planCopy,
  copyButtonLabels,
  COPY_FILL_NOTE,
  COPY_FAILED_TEXT,
  copyOutcome,
  copySuccessToast,
  imageFallbackToast,
  formatMediaSize,
} from "../components/copy-media.ts";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const IMG = {
  kind: "image",
  blobUrl: "https://s.public.blob.vercel-storage.com/media/1/87/a.jpg",
  blobPathname: "media/1/87/a.jpg",
  contentType: "image/jpeg",
  byteSize: 123456,
  width: 1600,
  height: 900,
  durationMs: null,
};

try {
  // ---- planCopy: the truth table (text only / text+image).
  check("planCopy text-only", planCopy(null, "عنوان").mode === "text");
  const pImg = planCopy(IMG, "عنوان");
  check(
    "planCopy image mode",
    pImg.mode === "text-image" && pImg.imageUrl === IMG.blobUrl,
    pImg.mode,
  );
  check(
    "planCopy has no video mode",
    !("videoUrl" in pImg) && !JSON.stringify(pImg).includes("video"),
  );

  // ---- copyButtonLabels: one definition for every surface.
  const textL = copyButtonLabels();
  check("text labels", textL.idle === "نسخ الرد" && textL.done === "اتنسخ");
  const imgL = copyButtonLabels();
  check("image labels same as text", imgL.idle === "نسخ الرد" && imgL.done === "اتنسخ");
  const textShort = copyButtonLabels(true);
  check("text short labels", textShort.idle === "نسخ" && textShort.done === "اتنسخ");

  // ---- fill-sheet neutral state.
  check("COPY_FILL_NOTE", COPY_FILL_NOTE === "كمّل البيانات…");

  // ---- toasts: honest wording.
  const toastImg = imageFallbackToast();
  check(
    "imageFallbackToast",
    toastImg.text === "اتنسخ النص بس — الصورة ما اتنسختش، نزّلها من التفاصيل" && toastImg.kind === "error",
    toastImg.text,
  );

  // ---- copyOutcome: the zero-error decision table (2026-11-26).
  // Every combination of step results, for both plans. The rule
  // under test: the image must land WITH the text for a full
  // success; any failure shows a real error, never a fake
  // success; a failed text write records no use.
  const steps = (combinedOk, textOk) => ({ combinedOk, textOk });
  const pText = planCopy(null, "تيست");
  const pImg2 = planCopy(IMG, "تيست");
  check("copySuccessToast", copySuccessToast("تيست").text === "اتنسخ «تيست» — الصقه في أي شات" && copySuccessToast("تيست").kind === "ok");
  check("COPY_FAILED_TEXT", COPY_FAILED_TEXT === "النسخ متعذر هنا");
  let o = copyOutcome(pText, steps(false, true), "تيست");
  check("outcome text ok", o.button === "copied" && o.toast?.kind === "ok" && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(pText, steps(false, false), "تيست");
  check("outcome text failed: no success, no use", o.button === "failed" && o.toast?.text === COPY_FAILED_TEXT && o.toast?.kind === "error" && o.recordUse === false, JSON.stringify(o));
  o = copyOutcome(pImg2, steps(true, false), "تيست");
  check("outcome image combined ok = full success", o.button === "copied" && o.toast?.kind === "ok" && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(pImg2, steps(true, true), "تيست");
  check("outcome image combined wins over text fallback", o.button === "copied" && o.toast?.kind === "ok" && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(pImg2, steps(false, true), "تيست");
  check(
    "outcome image convert/write failed + text ok = text-only + honest error toast, use recorded",
    o.button === "copied" && o.toast?.kind === "error" && o.toast?.text === imageFallbackToast().text && o.recordUse === true,
    JSON.stringify(o),
  );
  o = copyOutcome(pImg2, steps(false, false), "تيست");
  check("outcome image + text both failed = failed, no use", o.button === "failed" && o.toast?.text === COPY_FAILED_TEXT && o.recordUse === false, JSON.stringify(o));

  // ---- formatting.
  check("formatMediaSize bytes", formatMediaSize(500) === "1 كيلو", formatMediaSize(500));
  check("formatMediaSize KB", formatMediaSize(2048) === "2 كيلو", formatMediaSize(2048));
  check("formatMediaSize MB", formatMediaSize(2600000) === "2.5 ميجا", formatMediaSize(2600000));
  check("formatMediaSize whole MB", formatMediaSize(12582912) === "12 ميجا", formatMediaSize(12582912));
} catch (e) {
  console.log(`ERROR: ${e.stack ?? e.message}`);
  fail++;
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
