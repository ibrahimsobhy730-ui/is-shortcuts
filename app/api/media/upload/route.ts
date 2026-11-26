import { NextResponse } from "next/server";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { BlobAccessError } from "@vercel/blob";
import { createCtx } from "@/lib/ctx";
import { blobReadWriteToken } from "@/lib/blob-token";
import {
  getSessionUser,
  requireOwnedShortcut,
  mediaLimitsFor,
  MEDIA_PATH_RE,
} from "@/lib/actions";

/* Client-upload token route for reply media (IMAGES ONLY —
   video upload was cancelled by the owner 2026-11-26).
   The browser sends its file STRAIGHT to Vercel Blob — the bytes
   never pass through this function (a Serverless Function caps
   request bodies at ~4.5 MB on Hobby). This route only mints a
   short-lived, tightly-scoped token:
   - the client sends its session token + shortcutId as
     clientPayload (see the editor's uploadMedia);
   - onBeforeGenerateToken resolves the session, checks the reply
     really belongs to this user, and scopes the token to that
     reply's pathname prefix and the image allowlist + size cap.
   The DB row is written afterwards by the attachMedia action —
   never by the upload-completed callback (that callback is an
   inbound POST from Vercel's infrastructure and never arrives on
   localhost; attachMedia is the single source of truth).
   When no Blob store is connected yet (no Blob token configured —
   neither PUBLIC_BLOB_READ_WRITE_TOKEN nor BLOB_READ_WRITE_TOKEN),
   handleUpload throws BlobAccessError — answered here as 503 with
   the exact Arabic string the editor shows verbatim, never a fake
   success. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The Arabic string the editor shows when Blob storage is not
    connected on the server yet. */
export const MEDIA_STORAGE_NOT_CONFIGURED =
  "التخزين مش متظبط على السيرفر — الصور مش متاحة دلوقتي";

type MediaPayload = {
  token?: unknown;
  shortcutId?: unknown;
  kind?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  try {
    const response = await handleUpload({
      body,
      request,
      /* The token is resolved by lib/blob-token.ts: the Public
         store's PUBLIC_BLOB_READ_WRITE_TOKEN first, falling back
         to the legacy BLOB_READ_WRITE_TOKEN. Without this the SDK
         would read BLOB_READ_WRITE_TOKEN from the environment —
         which still points at the old Private store. */
      token: blobReadWriteToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: MediaPayload = {};
        try {
          payload = clientPayload ? (JSON.parse(clientPayload) as MediaPayload) : {};
        } catch {
          throw new Error("بيانات الرفع مش صحيحة");
        }
        const token = typeof payload.token === "string" ? payload.token : "";
        const shortcutId =
          typeof payload.shortcutId === "number" ? payload.shortcutId : 0;
        if (!token || !shortcutId) {
          throw new Error("بيانات الرفع ناقصة — سجّل دخولك وحاول تاني");
        }
        const ctx = createCtx();
        const user = await getSessionUser(ctx, token);
        if (!user) throw new Error("انتهت الجلسة — سجّل دخولك من جديد");
        await requireOwnedShortcut(ctx, user.id, shortcutId);
        /* The pathname must be ours: media/<my id>/<this reply>/
           <uuid>.<ext> — never another user's file, never an
           arbitrary path. */
        const pm = MEDIA_PATH_RE.exec(pathname);
        if (!pm || Number(pm[1]) !== user.id || Number(pm[2]) !== shortcutId) {
          throw new Error("مسار الملف مش صحيح");
        }
        const limits = mediaLimitsFor();
        return {
          allowedContentTypes: [...limits.contentTypes],
          maximumSizeInBytes: limits.maxBytes,
          /* The UUID in the pathname is the uniqueness — no random
             suffix is appended, so the pathname the client sent is
             exactly the pathname attachMedia records. */
          addRandomSuffix: false,
          tokenPayload: clientPayload ?? undefined,
        };
      },
      /* The DB row is written by attachMedia after the browser
         gets the blob back — not here. */
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(response);
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
