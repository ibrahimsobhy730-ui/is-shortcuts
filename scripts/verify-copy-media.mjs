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
  copySuccessToastMulti,
  multiImagePartialToast,
  multiImageFallbackToast,
  imageFallbackToast,
  formatMediaSize,
  mediaListOf,
  MAX_IMAGES_PER_REPLY,
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

  // ---- multi-image (2026-11-27): up to 3 images per reply.
  const img = (n) => ({
    id: n,
    position: n,
    kind: "image",
    blobUrl: `https://s.public.blob.vercel-storage.com/media/1/87/${n}.jpg`,
    blobPathname: `media/1/87/${n}.jpg`,
    contentType: "image/jpeg",
    byteSize: 100000 + n,
    width: 1600,
    height: 900,
    durationMs: null,
  });
  check("MAX_IMAGES_PER_REPLY is 3", MAX_IMAGES_PER_REPLY === 3);
  check("mediaListOf null/empty", mediaListOf(null).length === 0 && mediaListOf([]).length === 0);
  check("mediaListOf legacy single", mediaListOf(img(1)).length === 1 && mediaListOf(img(1))[0].id === 1);
  const shuffled = mediaListOf([img(3), img(1), img(2)]);
  check(
    "mediaListOf orders by position",
    shuffled.map((m) => m.id).join(",") === "1,2,3",
    shuffled.map((m) => m.id).join(","),
  );
  check("planCopy 0 images = text", planCopy([]).mode === "text");
  check("planCopy 1 image = text-image", planCopy([img(1)]).mode === "text-image");
  const p2 = planCopy([img(1), img(2)]);
  check(
    "planCopy 2 images = text-images with both urls",
    p2.mode === "text-images" && p2.imageUrls.length === 2 && p2.imageUrls[0].endsWith("/1.jpg"),
    JSON.stringify(p2),
  );
  const p3 = planCopy([img(1), img(2), img(3)]);
  check(
    "planCopy 3 images = text-images with all three urls",
    p3.mode === "text-images" && p3.imageUrls.length === 3,
    JSON.stringify(p3),
  );
  check(
    "planCopy 3 images has no video mode",
    !JSON.stringify(p3).includes("video"),
  );
  check(
    "copySuccessToastMulti names title + count",
    copySuccessToastMulti("تيست", 3).text === "اتنسخ «تيست» مع 3 صور — الصقهم في أي شات" && copySuccessToastMulti("تيست", 3).kind === "ok",
    copySuccessToastMulti("تيست", 3).text,
  );
  check(
    "multiImageFallbackToast names the count",
    multiImageFallbackToast(3).text === "اتنسخ النص بس — 3 صور ما اتنسختش، نزّلها من التفاصيل" && multiImageFallbackToast(3).kind === "error",
    multiImageFallbackToast(3).text,
  );
  check(
    "multiImagePartialToast downloaded=true",
    multiImagePartialToast(3, true).text === "اتنسخ النص وأول صورة بس — باقي الصور (2) اتنزلت كملفات",
    multiImagePartialToast(3, true).text,
  );
  check(
    "multiImagePartialToast downloaded=false",
    multiImagePartialToast(3, false).text === "اتنسخ النص وأول صورة بس — باقي الصور (2) نزّلها من التفاصيل",
    multiImagePartialToast(3, false).text,
  );
  // text-images truth table: one write attempted; honest fallback.
  const msteps = (combinedOk, firstOk, textOk, restDownloaded) => ({ combinedOk, firstOk, textOk, restDownloaded });
  o = copyOutcome(p3, msteps(true, false, false, false), "تيست");
  check("multi combined ok = full success naming 3", o.button === "copied" && o.toast?.text === copySuccessToastMulti("تيست", 3).text && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(p3, msteps(false, true, true, true), "تيست");
  check("multi firstOk + rest downloaded = partial, names downloads", o.button === "copied" && o.toast?.text === multiImagePartialToast(3, true).text && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(p3, msteps(false, true, true, false), "تيست");
  check("multi firstOk + rest NOT downloaded = partial, points to details", o.button === "copied" && o.toast?.text === multiImagePartialToast(3, false).text && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(p3, msteps(false, false, true, false), "تيست");
  check("multi textOk only = text-only + honest fallback naming 3", o.button === "copied" && o.toast?.text === multiImageFallbackToast(3).text && o.recordUse === true, JSON.stringify(o));
  o = copyOutcome(p3, msteps(false, false, false, false), "تيست");
  check("multi all failed = failed, no use, no fake success", o.button === "failed" && o.toast?.text === COPY_FAILED_TEXT && o.recordUse === false, JSON.stringify(o));
  o = copyOutcome(p2, msteps(false, true, true, true), "تيست");
  check("multi 2 images partial names the 1 remaining", o.button === "copied" && o.toast?.text === multiImagePartialToast(2, true).text, JSON.stringify(o));

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
