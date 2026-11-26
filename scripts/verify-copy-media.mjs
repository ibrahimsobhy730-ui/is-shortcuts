/* Test-only check of the pure copy-planning helpers in
   components/copy-media.ts (no DOM, no browser, no clipboard):
   the copy truth table (text only / text+image / text+video),
   button labels, toast wording, filenames, sizes and durations.
   The browser parts (ClipboardItem write, canvas conversion,
   <a download>) live in components/App.tsx and must be verified
   live; this script proves the decisions they are built on.
   Usage: node scripts/verify-copy-media.mjs */

import {
  planCopy,
  mediaFileName,
  copyButtonLabels,
  COPY_FILL_NOTE,
  videoCopyToast,
  imageFallbackToast,
  formatMediaSize,
  formatMediaDuration,
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
const VID = {
  kind: "video",
  blobUrl: "https://s.public.blob.vercel-storage.com/media/1/87/b.mp4",
  blobPathname: "media/1/87/b.mp4",
  contentType: "video/mp4",
  byteSize: 4000000,
  width: 1280,
  height: 720,
  durationMs: 90000,
};

try {
  // ---- planCopy: the truth table.
  check("planCopy text-only", planCopy(null, "عنوان").mode === "text");
  const pImg = planCopy(IMG, "عنوان");
  check(
    "planCopy image mode",
    pImg.mode === "text-image" && pImg.imageUrl === IMG.blobUrl,
    pImg.mode,
  );
  const pVid = planCopy(VID, "عنوان طويل للرد");
  check(
    "planCopy video mode carries a download name",
    pVid.mode === "text-video" && pVid.videoUrl === VID.blobUrl && pVid.fileName === "عنوان طويل للرد.mp4",
    pVid.mode === "text-video" ? pVid.fileName : pVid.mode,
  );
  check(
    "planCopy video never claims a clipboard video",
    JSON.stringify(pVid).includes("video") && !JSON.stringify(pVid).includes("clipboard"),
  );

  // ---- mediaFileName: video download names only (title +
  // content type; images are never downloaded by the copy flow).
  check("mediaFileName mp4 ext", mediaFileName("رد سلام", "video/mp4") === "رد سلام.mp4", mediaFileName("رد سلام", "video/mp4"));
  check("mediaFileName webm ext", mediaFileName("فيديو", "video/webm") === "فيديو.webm");
  check(
    "mediaFileName strips slashes",
    mediaFileName("أ/ب: ج؟", "video/mp4") === "أ-ب- ج؟.mp4",
    mediaFileName("أ/ب: ج؟", "video/mp4"),
  );
  check(
    "mediaFileName truncates long titles",
    mediaFileName("x".repeat(100), "video/mp4").length <= 64,
    `${mediaFileName("x".repeat(100), "video/mp4").length} chars`,
  );
  check("mediaFileName empty title", mediaFileName("   ", "video/mp4") === "رد.mp4");

  // ---- copyButtonLabels: one definition for every surface.
  const textL = copyButtonLabels(null);
  check("text labels", textL.idle === "نسخ الرد" && textL.done === "اتنسخ");
  const imgL = copyButtonLabels(IMG);
  check("image labels same as text", imgL.idle === "نسخ الرد" && imgL.done === "اتنسخ");
  const vidL = copyButtonLabels(VID);
  check(
    "video labels never say the video was copied",
    vidL.idle === "نسخ النص + تنزيل الفيديو" &&
      vidL.done === "اتنسخ النص ✓ · الفيديو بينزل" &&
      !vidL.done.includes("اتنسخ الفيديو"),
    vidL.done,
  );
  const vidShort = copyButtonLabels(VID, true);
  check(
    "video short labels",
    vidShort.idle === "نسخ + تنزيل" && vidShort.done === "اتنسخ ✓",
    `${vidShort.idle} / ${vidShort.done}`,
  );
  const textShort = copyButtonLabels(null, true);
  check("text short labels", textShort.idle === "نسخ" && textShort.done === "اتنسخ");

  // ---- fill-sheet neutral state.
  check("COPY_FILL_NOTE", COPY_FILL_NOTE === "كمّل البيانات…");

  // ---- toasts: honest wording, never "video copied".
  const toastOk = videoCopyToast("تيست", true);
  check(
    "videoCopyToast (downloaded)",
    toastOk.text === "اتنسخ نص «تيست» — الفيديو بينزل دلوقتي، ابعته من جهازك" && toastOk.kind === "ok",
    toastOk.text,
  );
  const toastBad = videoCopyToast("تيست", false);
  check(
    "videoCopyToast (download failed) still honest",
    toastBad.text === "اتنسخ النص — بس تنزيل الفيديو فشل، جرّب من التفاصيل" && toastBad.kind === "error",
    toastBad.text,
  );
  const toastImg = imageFallbackToast();
  check(
    "imageFallbackToast",
    toastImg.text === "اتنسخ النص بس — الصورة ما اتنسختش، نزّلها من التفاصيل" && toastImg.kind === "error",
    toastImg.text,
  );

  // ---- formatting.
  check("formatMediaSize bytes", formatMediaSize(500) === "1 كيلو", formatMediaSize(500));
  check("formatMediaSize KB", formatMediaSize(2048) === "2 كيلو", formatMediaSize(2048));
  check("formatMediaSize MB", formatMediaSize(2600000) === "2.5 ميجا", formatMediaSize(2600000));
  check("formatMediaSize whole MB", formatMediaSize(12582912) === "12 ميجا", formatMediaSize(12582912));
  check("formatMediaDuration null", formatMediaDuration(null) === "");
  check("formatMediaDuration 1:05", formatMediaDuration(65000) === "1:05", formatMediaDuration(65000));
  check("formatMediaDuration 0:05", formatMediaDuration(5000) === "0:05", formatMediaDuration(5000));
  check("formatMediaDuration 2:05", formatMediaDuration(125000) === "2:05", formatMediaDuration(125000));
} catch (e) {
  console.log(`ERROR: ${e.stack ?? e.message}`);
  fail++;
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 ? 0 : 1);
