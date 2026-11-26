/* Pure copy-planning helpers for reply media — no DOM, no React,
   so the decision logic is unit-testable in Node (see
   scripts/verify-copy-media.mjs). The browser-only steps
   (clipboard write, image→PNG conversion, file download) live in
   components/App.tsx next to copyText and call these planners.

   The truth table (the Clipboard API has no video MIME type, so a
   video is NEVER put on the clipboard — that is a spec fact, not
   a gap):
   - text only            → writeText(text)
   - text + image         → ONE ClipboardItem({ "text/plain", "image/png" })
                            in ONE write(); the image is converted to
                            PNG first (JPEG/WebP are not portable
                            clipboard image types). Paste into
                            WhatsApp Web / Chatwoot is EXPECTED to
                            take the richest format — unverified live.
   - text + video         → writeText(text) only + the video file
                            DOWNLOADS in the same tap. One action,
                            two honest outcomes. The UI must NEVER
                            say the video was "copied". */

export type MediaRef = {
  kind: "image" | "video";
  blobUrl: string;
  blobPathname: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
} | null | undefined;

export type CopyPlan =
  | { mode: "text" }
  | { mode: "text-image"; imageUrl: string }
  | { mode: "text-video"; videoUrl: string; fileName: string };

/** Which copy the reply needs, from its attached media (if any). */
export function planCopy(media: MediaRef, title: string): CopyPlan {
  if (!media) return { mode: "text" };
  if (media.kind === "image") return { mode: "text-image", imageUrl: media.blobUrl };
  return {
    mode: "text-video",
    videoUrl: media.blobUrl,
    fileName: mediaFileName(title, media.contentType),
  };
}

/** A safe download filename from the reply title + the video type. */
export function mediaFileName(title: string, contentType: string): string {
  const ext = contentType === "video/webm" ? "webm" : "mp4";
  const clean =
    title
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "رد";
  return `${clean}.${ext}`;
}

/** Copy-button labels for a reply with this media. short = the
    compact row pill, where space is tight — the full honest
    sentence still rides in the toast. */
export function copyButtonLabels(
  media: MediaRef,
  short = false,
): { idle: string; done: string } {
  if (media?.kind === "video") {
    return short
      ? { idle: "نسخ + تنزيل", done: "اتنسخ ✓" }
      : { idle: "نسخ النص + تنزيل الفيديو", done: "اتنسخ النص ✓ · الفيديو بينزل" };
  }
  return short
    ? { idle: "نسخ", done: "اتنسخ" }
    : { idle: "نسخ الرد", done: "اتنسخ" };
}

/** The neutral button state when a copy opened the fill-in sheet
    instead (the reply has manual {variables}): the copy has not
    happened yet, and the button must say so instead of flipping
    to «اتنسخ» or staying silent. */
export const COPY_FILL_NOTE = "كمّل البيانات…";

/** Toast after a video copy: the text landed; the video is
    downloading (or the download failed — the text is still copied
    and the use is still recorded). */
export function videoCopyToast(
  title: string,
  downloaded: boolean,
): { text: string; kind: "ok" | "error" } {
  return downloaded
    ? {
        text: `اتنسخ نص «${title}» — الفيديو بينزل دلوقتي، ابعته من جهازك`,
        kind: "ok",
      }
    : {
        text: "اتنسخ النص — بس تنزيل الفيديو فشل، جرّب من التفاصيل",
        kind: "error",
      };
}

/** Toast when the image could not be converted/copied but the
    text did land: the copy fell back to text-only, honestly. */
export function imageFallbackToast(): { text: string; kind: "error" } {
  return {
    text: "اتنسخ النص بس — الصورة ما اتنسختش، نزّلها من التفاصيل",
    kind: "error",
  };
}

/** The one success line every copy surface toasts when the text
    (and, for an image reply, the image with it) actually landed. */
export function copySuccessToast(title: string): { text: string; kind: "ok" } {
  return { text: `اتنسخ «${title}» — الصقه في أي شات`, kind: "ok" };
}

/** The one failure line when the text itself never landed — the
    whole action failed, nothing is recorded, nothing is claimed. */
export const COPY_FAILED_TEXT = "النسخ متعذر هنا";

/* The zero-error copy decision (متطلب المالك 2026-11-26: نسبة
   خطأ صفر — الصورة/الفيديو يتنسخ مع الكلام). The browser steps
   (clipboard write, image→PNG conversion, file download) live in
   components/App.tsx; THIS function is the single place that
   decides what those steps mean — so it is pure, exhaustively
   tested (scripts/verify-copy-media.mjs), and no path in the app
   can silently drop the image while claiming success:
   - text: the text write alone decides everything.
   - text-image: the combined text+image write MUST land for a
     full success. A failed combined write falls back to a plain
     text write; only if that lands too is the copy a (text-only)
     success — with the honest imageFallbackToast, never the
     success line. If the text write also fails, the whole action
     failed: no success state, no use recorded.
   - text-video: the text write decides the button and the use;
     the download is reported by its own toast when it settles
     (videoCopyToast). The button NEVER says the video was
     "copied" — its done label says the text was copied and the
     video is downloading. While the download is still pending
     there is no toast yet (toast: null). */
export type MediaCopySteps = {
  /** ONE ClipboardItem carrying text+image landed (image only). */
  combinedOk: boolean;
  /** A plain-text clipboard write landed. */
  textOk: boolean;
  /** Video download: "pending" while it runs, then settled. */
  download: "pending" | boolean;
};

export function copyOutcome(
  plan: CopyPlan,
  steps: MediaCopySteps,
  title: string,
): {
  button: "copied" | "failed";
  toast: { text: string; kind: "ok" | "error" } | null;
  recordUse: boolean;
} {
  if (plan.mode === "text") {
    return steps.textOk
      ? { button: "copied", toast: copySuccessToast(title), recordUse: true }
      : { button: "failed", toast: { text: COPY_FAILED_TEXT, kind: "error" }, recordUse: false };
  }
  if (plan.mode === "text-image") {
    if (steps.combinedOk) {
      return { button: "copied", toast: copySuccessToast(title), recordUse: true };
    }
    if (steps.textOk) {
      return { button: "copied", toast: imageFallbackToast(), recordUse: true };
    }
    return { button: "failed", toast: { text: COPY_FAILED_TEXT, kind: "error" }, recordUse: false };
  }
  /* text-video */
  if (!steps.textOk) {
    return { button: "failed", toast: { text: COPY_FAILED_TEXT, kind: "error" }, recordUse: false };
  }
  if (steps.download === "pending") {
    return { button: "copied", toast: null, recordUse: true };
  }
  return {
    button: "copied",
    toast: videoCopyToast(title, steps.download),
    recordUse: true,
  };
}

/** Human file size for the media UI ("2.4 ميجا", "380 كيلو"). */
export function formatMediaSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} ميجا`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} كيلو`;
}

/** "1:23" style duration for the video badge / details. */
export function formatMediaDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
