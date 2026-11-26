/* Pure copy-planning helpers for reply media — no DOM, no React,
   so the decision logic is unit-testable in Node (see
   scripts/verify-copy-media.mjs). The browser-only steps
   (clipboard write, image→PNG conversion) live in
   components/App.tsx next to copyText and call these planners.

   IMAGES ONLY (قرار المالك 2026-11-26): video upload was
   cancelled entirely — no video copy/download path exists anywhere
   in the app anymore. A reply holds UP TO 3 images (2026-11-27).
   The truth table:
   - text only            → writeText(text)
   - text + 1 image       → ONE ClipboardItem({ "text/plain", "image/png" })
                            in ONE write(); the image is converted to
                            PNG first (JPEG/WebP are not portable
                            clipboard image types). Paste into
                            WhatsApp Web / Chatwoot is EXPECTED to
                            take the richest format — unverified live.
   - text + 2–3 images    → ONE write() carrying one ClipboardItem
                            per image (each item: "text/plain" +
                            "image/png"). Whether a paste target
                            takes ALL items is NOT proven — no
                            browser here can prove it. If that write
                            fails, the honest fallback is text + the
                            FIRST image in one write, and the
                            remaining images are delivered as file
                            downloads in the same tap (never a fake
                            «all copied»). If even that fails, plain
                            text only, with the honest toast. */

/** Max images one reply may hold (owner's call 2026-11-27:
    «لحد صورتين ل 3 صور» — one is not enough, three is the cap).
    Enforced in the editor AND server-side (attachMedia). */
export const MAX_IMAGES_PER_REPLY = 3;

export type MediaRef = {
  id: number;
  position: number;
  kind: "image";
  blobUrl: string;
  blobPathname: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
} | null | undefined;

/** A reply's attached images, in display order (position 1–3).
    The server shape (shortcutShape.media) is this array; a single
    legacy MediaRef is still accepted here so older callers keep
    working while they migrate. */
export type MediaList = MediaRef | MediaRef[] | null | undefined;

/** The image rows of a reply, normalized to an array in position
    order (position 1 first). */
export function mediaListOf(media: MediaList): NonNullable<MediaRef>[] {
  const list = (Array.isArray(media) ? media : media ? [media] : []).filter(
    (m): m is NonNullable<MediaRef> => m != null && m.kind === "image",
  );
  return [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export type CopyPlan =
  | { mode: "text" }
  | { mode: "text-image"; imageUrl: string }
  | { mode: "text-images"; imageUrls: string[] };

/** Which copy the reply needs, from its attached media (if any). */
export function planCopy(media: MediaList): CopyPlan {
  const images = mediaListOf(media);
  if (images.length === 0) return { mode: "text" };
  if (images.length === 1) {
    const first = images[0];
    if (!first) return { mode: "text" };
    return { mode: "text-image", imageUrl: first.blobUrl };
  }
  return { mode: "text-images", imageUrls: images.map((m) => m.blobUrl) };
}

/** Copy-button labels for a reply with this media. short = the
    compact row pill, where space is tight — the full honest
    sentence still rides in the toast. */
/* Labels no longer depend on the media: an image reply copies
   exactly like a text reply (one combined write) — the parameter
   is gone so no caller can pass a video-shaped value. */
export function copyButtonLabels(short = false): {
  idle: string;
  done: string;
} {
  return short
    ? { idle: "نسخ", done: "اتنسخ" }
    : { idle: "نسخ الرد", done: "اتنسخ" };
}

/** The neutral button state when a copy opened the fill-in sheet
    instead (the reply has manual {variables}): the copy has not
    happened yet, and the button must say so instead of flipping
    to «اتنسخ» or staying silent. */
export const COPY_FILL_NOTE = "كمّل البيانات…";

/** Toast when the image could not be converted/copied but the
    text did land: the copy fell back to text-only, honestly. */
export function imageFallbackToast(): { text: string; kind: "error" } {
  return {
    text: "اتنسخ النص بس — الصورة ما اتنسختش، نزّلها من التفاصيل",
    kind: "error",
  };
}

/** Toast when a 2–3-image copy fell back to text-only: the text
    landed, NONE of the images did — the count is named, never
    hidden. */
export function multiImageFallbackToast(count: number): {
  text: string;
  kind: "error";
} {
  return {
    text: `اتنسخ النص بس — ${count} صور ما اتنسختش، نزّلها من التفاصيل`,
    kind: "error",
  };
}

/** Toast when a 2–3-image copy landed text + the FIRST image only:
    the rest could not ride the clipboard, so they were delivered
    as file downloads in the same tap (downloaded=true) — or, when
    even the downloads could not start, the user is sent to the
    details panel where every image has its own download button. */
export function multiImagePartialToast(
  total: number,
  downloaded: boolean,
): { text: string; kind: "error" } {
  const rest = total - 1;
  return {
    text: downloaded
      ? `اتنسخ النص وأول صورة بس — باقي الصور (${rest}) اتنزلت كملفات`
      : `اتنسخ النص وأول صورة بس — باقي الصور (${rest}) نزّلها من التفاصيل`,
    kind: "error",
  };
}

/** The one success line every copy surface toasts when the text
    (and, for an image reply, the image with it) actually landed. */
export function copySuccessToast(title: string): { text: string; kind: "ok" } {
  return { text: `اتنسخ «${title}» — الصقه في أي شات`, kind: "ok" };
}

/** Success line when text + ALL images landed in the one write. */
export function copySuccessToastMulti(
  title: string,
  count: number,
): { text: string; kind: "ok" } {
  return {
    text: `اتنسخ «${title}» مع ${count} صور — الصقهم في أي شات`,
    kind: "ok",
  };
}

/** The one failure line when the text itself never landed — the
    whole action failed, nothing is recorded, nothing is claimed. */
export const COPY_FAILED_TEXT = "النسخ متعذر هنا";

/* The zero-error copy decision (متطلب المالك 2026-11-26: نسبة
   خطأ صفر — الصورة تتنسخ مع الكلام). The browser steps
   (clipboard write, image→PNG conversion) live in
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
   - text-images (2–3): the ONE write carrying text + ALL images
     MUST land for a full success. If it fails, the fallback is
     text + the FIRST image in one write; only if that lands is
     the copy a partial success — with the honest
     multiImagePartialToast naming the remaining images and whether
     they were delivered as downloads (restDownloaded), never the
     full success line. If that fails too, a plain text write;
     only if that lands is the copy a text-only success — with the
     honest multiImageFallbackToast. If the text write also fails,
     the whole action failed: no success state, no use recorded.
     A paste target that takes only the first ClipboardItem is
     UNPROVEN live — the code attempts the full write and reports
     exactly what landed; it never claims what it cannot prove. */
export type MediaCopySteps = {
  /** ONE write carrying text + ALL images landed. */
  combinedOk: boolean;
  /** The text + FIRST image write landed (multi-image fallback). */
  firstOk?: boolean;
  /** A plain-text clipboard write landed. */
  textOk: boolean;
  /** The remaining images were delivered as file downloads. */
  restDownloaded?: boolean;
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
    /* text-image */
    if (steps.combinedOk) {
      return { button: "copied", toast: copySuccessToast(title), recordUse: true };
    }
    if (steps.textOk) {
      return { button: "copied", toast: imageFallbackToast(), recordUse: true };
    }
    return { button: "failed", toast: { text: COPY_FAILED_TEXT, kind: "error" }, recordUse: false };
  }
  /* text-images (2–3) */
  const total = plan.imageUrls.length;
  if (steps.combinedOk) {
    return {
      button: "copied",
      toast: copySuccessToastMulti(title, total),
      recordUse: true,
    };
  }
  if (steps.firstOk) {
    return {
      button: "copied",
      toast: multiImagePartialToast(total, steps.restDownloaded === true),
      recordUse: true,
    };
  }
  if (steps.textOk) {
    return {
      button: "copied",
      toast: multiImageFallbackToast(total),
      recordUse: true,
    };
  }
  return { button: "failed", toast: { text: COPY_FAILED_TEXT, kind: "error" }, recordUse: false };
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
