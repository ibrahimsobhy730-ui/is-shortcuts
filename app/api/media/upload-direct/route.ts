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
   included) — videos failing both direct paths get an honest
   message instead of a spinner, never a fake success.
   The same validations as the token route run first: session,
   reply ownership, pathname shape, kind + content-type + size. */

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
  const kindRaw = form.get("kind");
  const pathnameRaw = form.get("pathname");
  const file = form.get("file");
  const shortcutId =
    typeof shortcutIdRaw === "string" ? Number(shortcutIdRaw) : NaN;
  const kind = kindRaw === "video" ? "video" : kindRaw === "image" ? "image" : null;
  if (
    typeof token !== "string" ||
    !token ||
    !Number.isInteger(shortcutId) ||
    shortcutId <= 0 ||
    !kind ||
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
    const limits = mediaLimitsFor(kind);
    if (!(limits.contentTypes as readonly string[]).includes(file.type)) {
      throw new Error(
        kind === "image"
          ? "الصورة لازم تكون JPG أو PNG أو WebP — الـ GIF مش مدعوم دلوقتي"
          : "الفيديو لازم يكون MP4 أو WebM — الـ MOV مش مدعوم دلوقتي",
      );
    }
    if (file.size > limits.maxBytes || file.size > SERVER_UPLOAD_MAX_BYTES) {
      throw new Error(
        file.size > SERVER_UPLOAD_MAX_BYTES
          ? "الملف كبير على الرفع من السيرفر — جرّب من المتصفح مباشرة"
          : kind === "image"
            ? "الصورة أكبر من 8 ميجا — جرّب صورة أصغر"
            : "الفيديو أكبر من 50 ميجا — جرّب فيديو أصغر",
      );
    }
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
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
