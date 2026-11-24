import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { avatarBlobs } from "@/lib/schema";
import { getDb } from "@/lib/db";

/* Serves a user's profile picture: GET /api/avatar/<userId>.
   Bytes live in the avatar_blobs table under the key
   `avatars/<userId>` (same keys the Muse artifact used in its blob
   store). 404 when the account has no picture — the client falls
   back to the name's initial. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  if (!/^\d+$/.test(userId)) {
    return new NextResponse("not found", { status: 404 });
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(avatarBlobs)
    .where(eq(avatarBlobs.key, `avatars/${userId}`))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return new NextResponse("not found", { status: 404 });
  }
  return new NextResponse(row.data as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": row.contentType,
      "cache-control": "private, max-age=3600",
    },
  });
}
