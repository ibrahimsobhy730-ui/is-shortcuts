import { NextResponse } from "next/server";
import { Actions } from "@/lib/actions";
import { createCtx } from "@/lib/ctx";

/* The single server endpoint the client talks to — the local
   equivalent of the SDK's `./actions` endpoint.
   POST { action, args } -> { data, invalidated } on success.
   - Unknown action: 404 { error }.
   - Request-schema failure: 422 { error: "invalid args: <zod issues JSON>" }
     — the same shape the Muse VM worker sent, so the client's issue
     parsing reads it unchanged.
   - Handler error (thrown Error, e.g. "انتهت الجلسة"): 400 { error }.
   - Response-schema failure: 500 { error: "response validation failed" }.
   Handlers run against Neon Postgres through lib/db (DATABASE_URL).
   No credential is read or returned here. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const actionName =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>).action
      : undefined;
  const args =
    body !== null && typeof body === "object"
      ? ((body as Record<string, unknown>).args ?? {})
      : {};
  if (typeof actionName !== "string" || actionName.length === 0) {
    return NextResponse.json({ error: "missing action" }, { status: 400 });
  }
  type SafeParse<T> =
    | { success: true; data: T }
    | { success: false; error: { issues: unknown } };
  type ActionDef = {
    request: { safeParse: (v: unknown) => SafeParse<unknown> };
    response: { safeParse: (v: unknown) => SafeParse<unknown> };
    handler: (ctx: unknown, args: never) => Promise<unknown>;
  };
  const def = (Actions as Record<string, ActionDef>)[actionName];
  if (!def) {
    return NextResponse.json(
      { error: `unknown action: ${actionName}` },
      { status: 404 },
    );
  }
  const parsed = def.request.safeParse(args);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid args: " + JSON.stringify(parsed.error.issues) },
      { status: 422 },
    );
  }
  try {
    const ctx = createCtx();
    const data = await def.handler(ctx, parsed.data as never);
    const out = def.response.safeParse(data);
    if (!out.success) {
      // The handler already ran, so the write may have happened —
      // report it as an unknown outcome, like the VM did.
      return NextResponse.json(
        { error: "response validation failed" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      data: out.data,
      invalidated: ctx.invalidated,
      ...(ctx.invalidatedKeys !== null
        ? { invalidatedKeys: ctx.invalidatedKeys }
        : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
