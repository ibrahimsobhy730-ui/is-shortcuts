import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { BlobAccessError } from "@vercel/blob";
import { createCtx } from "@/lib/ctx";
import {
  getSessionUser,
  requireOwnedShortcut,
  mediaLimitsFor,
  MEDIA_PATH_RE,
} from "@/lib/actions";
import { MEDIA_STORAGE_NOT_CONFIGURED } from "../upload/route";

/* Server-proxied media upload — fallback 2 for the client upload
   path (2026-11-26). The browser normally sends its bytes STRAIGHT
   to Vercel Blob (see /api/media/upload + uploadMediaFile); when
   that direct path stalls or fails in a given browser, the editor
   retries once over XHR, and then here: the bytes travel through
   this route, which put()s them with BLOB_READ_WRITE_TOKEN.
   Serverless request bodies cap at ~4.5 MB, so this route takes
   images/small files only (4 MB hard cap, multipart overhead
   included) — IMAGES ONLY (video upload was cancelled by the
   owner 2026-11-26).
   The same validations as the token route run first: session,
   reply ownership, pathname shape, content-type + size.
   DIAGNOSABILITY (2026-11-26): a put() failure used to surface
   only the SDK's bare message, so the client classifier saw no
   cause. Failures from put() now answer 502 with { error, status,
   code } — the code is the Blob API code when the message carries
   one, else "blob_put_failed". */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard body cap for this route: 4 MB (under the ~4.5 MB
    serverless limit, with room for multipart overhead). */
export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "الرفع متمّش — حاول تاني" }, { status: 400 });
  }
  const token = form.get("token");
  const shortcutIdRaw = form.get("shortcutId");
  const pathnameRaw = form.get("pathname");
  const file = form.get("file");
  const shortcutId =
    typeof shortcutIdRaw === "string" ? Number(shortcutIdRaw) : NaN;
  if (
    typeof token !== "string" ||
    !token ||
    !Number.isInteger(shortcutId) ||
    shortcutId <= 0 ||
    typeof pathnameRaw !== "string" ||
    !(file instanceof File)
  ) {
    return NextResponse.json(
      { error: "بيانات الرفع ناقصة — سجّل دخولك وحاول تاني" },
      { status: 400 },
    );
  }
  const pathname = pathnameRaw;
  try {
    const ctx = createCtx();
    const user = await getSessionUser(ctx, token);
    if (!user) throw new Error("انتهت الجلسة — سجّل دخولك من جديد");
    await requireOwnedShortcut(ctx, user.id, shortcutId);
    const pm = MEDIA_PATH_RE.exec(pathname);
    if (!pm || Number(pm[1]) !== user.id || Number(pm[2]) !== shortcutId) {
      throw new Error("مسار الملف مش صحيح");
    }
    const limits = mediaLimitsFor();
    if (!(limits.contentTypes as readonly string[]).includes(file.type)) {
      throw new Error(
        "الصورة لازم تكون JPG أو PNG أو WebP — الـ GIF مش مدعوم دلوقتي",
      );
    }
    if (file.size > limits.maxBytes || file.size > SERVER_UPLOAD_MAX_BYTES) {
      throw new Error(
        file.size > SERVER_UPLOAD_MAX_BYTES
          ? "الملف كبير على الرفع من السيرفر — جرّب من المتصفح مباشرة"
          : "الصورة أكبر من 8 ميجا — جرّب صورة أصغر",
      );
    }
    try {
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.type,
      });
      return NextResponse.json({ url: blob.url, pathname: blob.pathname });
    } catch (putError) {
      /* put() throws only the error, discarding the Blob API's
         code — recover the code from the message when it carries
         one, so the client classifier can name the cause. */
      if (putError instanceof BlobAccessError) throw putError;
      const putMsg =
        putError instanceof Error ? putError.message : "الرفع متمّش";
      const codeMatch =
        /(store_not_found|not_allowed|unknown_error|service_unavailable|rate_limited)/i.exec(
          putMsg,
        );
      return NextResponse.json(
        {
          error: putMsg,
          status: 502,
          code: codeMatch?.[1] ? codeMatch[1].toLowerCase() : "blob_put_failed",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    if (error instanceof BlobAccessError) {
      return NextResponse.json(
        { error: MEDIA_STORAGE_NOT_CONFIGURED },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "الرفع متمّش";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
